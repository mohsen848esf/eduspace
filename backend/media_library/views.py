import mimetypes
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, PermissionDenied, ValidationError
from django.db.models import Prefetch, Q
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from media_library.models import (
    MediaAsset, MediaRendition, MediaUploadSession, ProgressiveMediaUpload,
    SharedPlaybackSession,
)
from media_library.permissions import (
    MediaLibraryPermissionError,
)
from media_library.services.delivery import MediaDeliveryError, MediaDeliveryService
from media_library.storage import S3MultipartUploadStorage
from media_library.serializers import (
    CompleteMediaUploadSerializer,
    InitiateMediaUploadSerializer,
    MediaAssetCreateSerializer,
    MediaAssetSerializer,
    MediaUploadSessionSerializer,
    OpenSharedPlaybackSerializer,
    SharedPlaybackCommandSerializer,
    SharedPlaybackSerializer,
    SignMediaUploadPartSerializer,
    UploadedMediaPartSerializer,
    CommitProgressiveChunkSerializer,
    InitiateProgressiveUploadSerializer,
    ProgressiveMediaChunkSerializer,
    ProgressiveMediaUploadSerializer,
    SignProgressiveChunkSerializer,
)
from media_library.services import (
    MediaAssetService, MediaUploadService, ProgressiveUploadError,
    ProgressiveUploadService, SharedPlaybackService,
)
from rooms.models import Room
from rooms.services.permissions import RoomPermissionError, permission_snapshot


def _success(data, *, message='', response_status=status.HTTP_200_OK):
    return Response(
        {'status': 'success', 'data': data, 'message': message},
        status=response_status,
    )


def _error(message, code, response_status, details=None):
    return Response(
        {'error': str(message), 'code': code, 'details': details},
        status=response_status,
    )


def _handle_domain_error(exc):
    if isinstance(exc, ProgressiveUploadError):
        return _error(exc, exc.code, exc.status_code)
    if isinstance(exc, MediaLibraryPermissionError):
        return _error(exc, exc.code, exc.status_code)
    if isinstance(exc, RoomPermissionError):
        return _error(exc, exc.code, exc.status_code)
    if isinstance(exc, PermissionDenied):
        return _error(exc, 'FORBIDDEN', status.HTTP_403_FORBIDDEN)
    if isinstance(exc, ValidationError):
        messages = getattr(exc, 'messages', None) or [str(exc)]
        domain_code = getattr(exc, 'code', None)
        if not domain_code and getattr(exc, 'error_list', None):
            domain_code = getattr(exc.error_list[0], 'code', None)
        code = domain_code or (
            'STALE_PLAYBACK_VERSION'
            if any('stale' in message.lower() for message in messages)
            else 'VALIDATION_ERROR'
        )
        response_status = (
            status.HTTP_409_CONFLICT
            if code in {'STALE_PLAYBACK_VERSION', 'ACTIVE_SHARED_PLAYBACK'}
            else status.HTTP_400_BAD_REQUEST
        )
        return _error(messages[0], code, response_status, messages)
    if isinstance(exc, ImproperlyConfigured):
        return _error(exc, 'STORAGE_NOT_CONFIGURED', status.HTTP_503_SERVICE_UNAVAILABLE)
    raise exc


def _asset_queryset():
    return MediaAsset.objects.select_related('owner', 'uploader').prefetch_related(
        Prefetch('renditions', queryset=MediaRendition.objects.order_by('height', 'bitrate_bps')),
    )


def _owned_asset_queryset(user):
    queryset = _asset_queryset()
    return queryset if user.is_superuser else queryset.filter(owner=user)


def _playback_queryset():
    return SharedPlaybackSession.objects.select_related(
        'room', 'asset', 'asset__owner', 'asset__uploader', 'controller',
    ).prefetch_related('asset__renditions')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assets(request):
    try:
        if request.method == 'POST':
            serializer = MediaAssetCreateSerializer(data=request.data)
            if not serializer.is_valid():
                return _error(
                    'Media asset data is invalid.', 'INVALID_MEDIA_ASSET',
                    status.HTTP_400_BAD_REQUEST, serializer.errors,
                )
            asset = MediaAsset.objects.create(
                owner=request.user,
                uploader=request.user,
                **serializer.validated_data,
            )
            return _success(
                MediaAssetSerializer(asset).data,
                message='Media asset created.',
                response_status=status.HTTP_201_CREATED,
            )

        queryset = _asset_queryset().filter(
            owner=request.user,
            is_deleted=False,
        )
        if request.query_params.get('status'):
            queryset = queryset.filter(status=request.query_params['status'])
        query = request.query_params.get('q', '').strip()
        if query:
            queryset = queryset.filter(
                Q(title__icontains=query) | Q(original_filename__icontains=query),
            )
        total = queryset.count()
        rows = MediaAssetSerializer(queryset[:100], many=True).data
        return _success({'count': total, 'results': rows})
    except (MediaLibraryPermissionError, PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def asset_detail(request, public_token):
    try:
        asset = get_object_or_404(
            _owned_asset_queryset(request.user),
            public_token=public_token,
            is_deleted=False,
        )
        if request.method == 'DELETE':
            MediaAssetService.mark_deleted(asset=asset, actor=request.user)
            return _success({'public_token': public_token}, message='Media asset deleted.')
        return _success(MediaAssetSerializer(asset).data)
    except (MediaLibraryPermissionError, PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def asset_history(request, public_token):
    try:
        asset = get_object_or_404(
            _owned_asset_queryset(request.user),
            public_token=public_token,
            is_deleted=False,
        )
        server_now = timezone.now()
        queryset = _playback_queryset().filter(asset=asset)
        total = queryset.count()
        rows = queryset[:100]
        data = SharedPlaybackSerializer(
            rows,
            many=True,
            context={'server_now': server_now},
        ).data
        return _success({'count': total, 'results': data})
    except (MediaLibraryPermissionError, PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def open_shared_playback(request, room_code):
    serializer = OpenSharedPlaybackSerializer(data=request.data)
    if not serializer.is_valid():
        return _error(
            'Shared playback data is invalid.', 'INVALID_SHARED_PLAYBACK',
            status.HTTP_400_BAD_REQUEST, serializer.errors,
        )
    room = get_object_or_404(Room.objects.select_related('host'), room_code=room_code)
    try:
        token = serializer.validated_data['asset_public_token']
        asset = get_object_or_404(
            _asset_queryset(),
            public_token=token,
            owner_id__in={room.host_id, request.user.id},
            is_deleted=False,
        )
        resumed_from_id = serializer.validated_data.get('resumed_from_id')
        resumed_from = None
        if resumed_from_id is not None:
            resumed_from = get_object_or_404(
                _playback_queryset(),
                pk=resumed_from_id,
                asset=asset,
            )
        playback = SharedPlaybackService.open_session(
            room=room,
            asset=asset,
            actor=request.user,
            resumed_from=resumed_from,
            start_position_ms=serializer.validated_data.get('start_position_ms'),
        )
        playback = _playback_queryset().get(pk=playback.pk)
        server_now = timezone.now()
        return _success(
            SharedPlaybackSerializer(playback, context={'server_now': server_now}).data,
            message='Shared playback opened.',
            response_status=status.HTTP_201_CREATED,
        )
    except (PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def command_shared_playback(request, room_code):
    serializer = SharedPlaybackCommandSerializer(data=request.data)
    if not serializer.is_valid():
        return _error(
            'Playback command is invalid.', 'INVALID_PLAYBACK_COMMAND',
            status.HTTP_400_BAD_REQUEST, serializer.errors,
        )
    room = get_object_or_404(Room, room_code=room_code)
    playback = get_object_or_404(
        _playback_queryset(),
        room=room,
        ended_at__isnull=True,
    )
    try:
        command_data = dict(serializer.validated_data)
        lead_time_ms = command_data.pop('lead_time_ms')
        command_data['effective_at'] = (
            timezone.now() + timedelta(milliseconds=lead_time_ms)
            if command_data['command'] == 'PLAY'
            else timezone.now()
        )
        playback = SharedPlaybackService.apply_command(
            playback=playback,
            actor=request.user,
            **command_data,
        )
        playback = _playback_queryset().get(pk=playback.pk)
        server_now = timezone.now()
        return _success(
            SharedPlaybackSerializer(playback, context={'server_now': server_now}).data,
            message='Playback command applied.',
        )
    except (PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([AllowAny])
def shared_playback_snapshot(request, room_code):
    room = get_object_or_404(Room.objects.select_related('host'), room_code=room_code)
    try:
        permission_snapshot(
            room=room,
            user=request.user,
            guest_access_token=request.headers.get('X-Guest-Access-Token'),
        )
        playback = _playback_queryset().filter(
            room=room,
            ended_at__isnull=True,
        ).first()
        server_now = timezone.now()
        data = (
            SharedPlaybackSerializer(playback, context={'server_now': server_now}).data
            if playback is not None
            else None
        )
        response = _success({
            'playback': data,
            'server_now': server_now.isoformat(),
        })
        response['Cache-Control'] = 'no-store'
        return response
    except RoomPermissionError as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_media_upload(request, public_token):
    serializer = InitiateMediaUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Upload data is invalid.', 'INVALID_UPLOAD', 400, serializer.errors)
    asset = get_object_or_404(
        _owned_asset_queryset(request.user),
        public_token=public_token,
        is_deleted=False,
    )
    try:
        upload = MediaUploadService.initiate(
            asset=asset,
            actor=request.user,
            **serializer.validated_data,
        )
        return _success(
            MediaUploadSessionSerializer(upload).data,
            message='Multipart upload initiated.',
            response_status=status.HTTP_201_CREATED,
        )
    except (PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


def _upload_for_owner(public_token, upload_token, user):
    return get_object_or_404(
        MediaUploadSession.objects.select_related('asset', 'asset__owner'),
        public_token=upload_token,
        asset__public_token=public_token,
        asset__owner=user,
        asset__is_deleted=False,
    )


def _progressive_upload_for_owner(public_token, upload_token, user):
    return get_object_or_404(
        ProgressiveMediaUpload.objects.select_related('asset', 'asset__owner').prefetch_related('chunks'),
        public_token=upload_token,
        asset__public_token=public_token,
        asset__owner=user,
        asset__is_deleted=False,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def progressive_upload_capability(request):
    del request
    return _success(ProgressiveUploadService.capabilities())


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_progressive_upload(request, public_token):
    serializer = InitiateProgressiveUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Progressive upload data is invalid.', 'INVALID_PROGRESSIVE_UPLOAD', 400, serializer.errors)
    asset = get_object_or_404(
        _owned_asset_queryset(request.user), public_token=public_token, is_deleted=False,
    )
    try:
        upload = ProgressiveUploadService.initiate(
            asset=asset, actor=request.user, **serializer.validated_data,
        )
        return _success(
            ProgressiveMediaUploadSerializer(upload).data,
            message='Progressive upload initiated.',
            response_status=status.HTTP_201_CREATED,
        )
    except (ProgressiveUploadError, PermissionDenied, ValidationError) as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def progressive_upload_status(request, public_token, upload_token):
    upload = _progressive_upload_for_owner(public_token, upload_token, request.user)
    return _success({
        'upload': ProgressiveMediaUploadSerializer(upload).data,
        'chunks': ProgressiveMediaChunkSerializer(upload.chunks.all(), many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_progressive_chunk(request, public_token, upload_token):
    serializer = SignProgressiveChunkSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Progressive chunk data is invalid.', 'INVALID_PROGRESSIVE_CHUNK', 400, serializer.errors)
    upload = _progressive_upload_for_owner(public_token, upload_token, request.user)
    try:
        chunk, url = ProgressiveUploadService.sign_chunk(
            upload=upload, actor=request.user, **serializer.validated_data,
        )
        return _success({
            'chunk': ProgressiveMediaChunkSerializer(chunk).data,
            'upload_url': url,
            'expires_in_seconds': settings.MEDIA_UPLOAD_URL_TTL_SECONDS,
        })
    except (ProgressiveUploadError, PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def commit_progressive_chunk(request, public_token, upload_token):
    serializer = CommitProgressiveChunkSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Progressive chunk commit is invalid.', 'INVALID_PROGRESSIVE_CHUNK_COMMIT', 400, serializer.errors)
    upload = _progressive_upload_for_owner(public_token, upload_token, request.user)
    try:
        chunk = ProgressiveUploadService.commit_chunk(
            upload=upload, actor=request.user, **serializer.validated_data,
        )
        return _success(ProgressiveMediaChunkSerializer(chunk).data, message='Chunk queued for verification.')
    except (ProgressiveUploadError, PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_progressive_upload(request, public_token, upload_token):
    upload = _progressive_upload_for_owner(public_token, upload_token, request.user)
    try:
        upload = ProgressiveUploadService.finalize(upload=upload, actor=request.user)
        return _success(
            ProgressiveMediaUploadSerializer(upload).data,
            message='Verified chunks composed and queued for inspection.',
        )
    except (ProgressiveUploadError, PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def media_upload_status(request, public_token, upload_token):
    upload = _upload_for_owner(public_token, upload_token, request.user)
    try:
        upload, parts = MediaUploadService.resume_state(
            session=upload,
            actor=request.user,
        )
        return _success({
            'upload': MediaUploadSessionSerializer(upload).data,
            'parts': UploadedMediaPartSerializer(parts, many=True).data,
        })
    except (PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_media_upload_part(request, public_token, upload_token):
    serializer = SignMediaUploadPartSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Upload part data is invalid.', 'INVALID_UPLOAD_PART', 400, serializer.errors)
    upload = _upload_for_owner(public_token, upload_token, request.user)
    try:
        url = MediaUploadService.sign_part(
            session=upload,
            actor=request.user,
            **serializer.validated_data,
        )
        return _success({
            'part_number': serializer.validated_data['part_number'],
            'upload_url': url,
            'expires_in_seconds': settings.MEDIA_UPLOAD_URL_TTL_SECONDS,
        })
    except (PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_media_upload(request, public_token, upload_token):
    serializer = CompleteMediaUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return _error('Completed parts are invalid.', 'INVALID_COMPLETED_PARTS', 400, serializer.errors)
    upload = _upload_for_owner(public_token, upload_token, request.user)
    parts = [
        {'PartNumber': part['part_number'], 'ETag': part['etag']}
        for part in serializer.validated_data['parts']
    ]
    try:
        upload = MediaUploadService.complete(
            session=upload,
            actor=request.user,
            parts=parts,
        )
        return _success(
            MediaUploadSessionSerializer(upload).data,
            message='Upload completed and queued for inspection.',
        )
    except (PermissionDenied, ValidationError, ImproperlyConfigured) as exc:
        return _handle_domain_error(exc)


def _delivery_error(exc):
    response_status = {
        'INVALID_PLAYBACK_TICKET': status.HTTP_401_UNAUTHORIZED,
        'PLAYBACK_DELIVERY_NOT_AVAILABLE': status.HTTP_410_GONE,
    }.get(exc.code, status.HTTP_400_BAD_REQUEST)
    return _error(exc, exc.code, response_status)


@api_view(['POST'])
@permission_classes([AllowAny])
def issue_shared_playback_delivery(request, room_code):
    room = get_object_or_404(Room.objects.select_related('host'), room_code=room_code)
    try:
        permission_snapshot(
            room=room,
            user=request.user,
            guest_access_token=request.headers.get('X-Guest-Access-Token'),
        )
        playback = get_object_or_404(
            _playback_queryset(),
            room=room,
            ended_at__isnull=True,
        )
        ticket = MediaDeliveryService.issue_ticket(playback)
        master_path = reverse('media_delivery_master')
        master_url = request.build_absolute_uri(f'{master_path}?{urlencode({"ticket": ticket})}')
        return _success({
            'playback_id': playback.pk,
            'asset_public_token': playback.asset.public_token,
            'master_url': master_url,
            'expires_in_seconds': settings.MEDIA_PLAYBACK_TICKET_TTL_SECONDS,
        })
    except RoomPermissionError as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([AllowAny])
def media_delivery_master(request):
    try:
        ticket = request.query_params.get('ticket', '')
        playback = MediaDeliveryService.resolve_ticket(ticket)
        renditions = playback.asset.renditions.filter(
            status__in=[MediaRendition.Status.PLAYABLE, MediaRendition.Status.READY],
        ).order_by('height')
        # The progressive rendition is the temporary play-while-uploading stream.
        # Once final ABR renditions are ready, keeping it in the master playlist
        # creates a duplicate 360p level and makes quality switching ambiguous.
        if (
            playback.asset.status == MediaAsset.Status.READY
            and renditions.exclude(label='progressive').exists()
        ):
            renditions = renditions.exclude(label='progressive')
        if not renditions:
            raise MediaDeliveryError('PLAYBACK_DELIVERY_NOT_AVAILABLE')
        codecs = 'avc1.4d401f,mp4a.40.2' if playback.asset.audio_codec else 'avc1.4d401f'
        lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']
        for rendition in renditions:
            path = reverse('media_delivery_variant', kwargs={'label': rendition.label})
            url = request.build_absolute_uri(f'{path}?{urlencode({"ticket": ticket})}')
            stream_info = (
                f'#EXT-X-STREAM-INF:BANDWIDTH={rendition.bitrate_bps},'
                f'RESOLUTION={rendition.width}x{rendition.height}'
            )
            if rendition.label != 'progressive':
                stream_info += f',CODECS="{codecs}"'
            lines.extend([stream_info, url])
        response = HttpResponse('\n'.join(lines) + '\n', content_type='application/vnd.apple.mpegurl')
        response['Cache-Control'] = 'no-store'
        return response
    except MediaDeliveryError as exc:
        return _delivery_error(exc)


@api_view(['GET'])
@permission_classes([AllowAny])
def media_delivery_variant(request, label):
    try:
        ticket = request.query_params.get('ticket', '')
        playback = MediaDeliveryService.resolve_ticket(ticket)
        rendition = get_object_or_404(
            playback.asset.renditions,
            label=label,
            status__in=[MediaRendition.Status.PLAYABLE, MediaRendition.Status.READY],
        )
        storage = S3MultipartUploadStorage()
        playlist = storage.read_text(object_key=rendition.manifest_path)
        object_prefix = rendition.manifest_path.rsplit('/', 1)[0]

        def segment_url(filename):
            if settings.MEDIA_PLAYBACK_DIRECT_OBJECT_URLS:
                return storage.sign_download(
                    object_key=f'{object_prefix}/{filename}',
                )
            path = reverse(
                'media_delivery_segment',
                kwargs={'label': rendition.label, 'filename': filename},
            )
            return request.build_absolute_uri(f'{path}?{urlencode({"ticket": ticket})}')

        rewritten = MediaDeliveryService.rewrite_variant_playlist(
            playlist=playlist,
            segment_url=segment_url,
        )
        response = HttpResponse(rewritten, content_type='application/vnd.apple.mpegurl')
        response['Cache-Control'] = 'no-store'
        return response
    except MediaDeliveryError as exc:
        return _delivery_error(exc)
    except ImproperlyConfigured as exc:
        return _handle_domain_error(exc)


@api_view(['GET'])
@permission_classes([AllowAny])
def media_delivery_segment(request, label, filename):
    try:
        ticket = request.query_params.get('ticket', '')
        playback = MediaDeliveryService.resolve_ticket(ticket)
        MediaDeliveryService.require_segment_name(filename)
        rendition = get_object_or_404(
            playback.asset.renditions,
            label=label,
            status__in=[MediaRendition.Status.PLAYABLE, MediaRendition.Status.READY],
        )
        prefix = rendition.manifest_path.rsplit('/', 1)[0]
        storage = S3MultipartUploadStorage()
        object_key = f'{prefix}/{filename}'
        metadata = storage.head(object_key=object_key)
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        response = StreamingHttpResponse(
            storage.iter_bytes(object_key=object_key),
            content_type=content_type,
        )
        response['Content-Length'] = str(metadata['size_bytes'])
        response['ETag'] = f'"{metadata["etag"]}"'
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
    except MediaDeliveryError as exc:
        return _delivery_error(exc)
    except ImproperlyConfigured as exc:
        return _handle_domain_error(exc)
