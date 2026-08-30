import hashlib
import tempfile
from pathlib import Path

from django.conf import settings
from django.db import transaction

from media_library.inspection import MediaProbeError, detect_container_signature, probe_media_file
from media_library.models import MediaAsset, MediaUploadSession
from media_library.storage import S3MultipartUploadStorage


class MediaInspectionError(RuntimeError):
    def __init__(self, code: str, *, retryable: bool = False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


class MediaInspectionService:
    VIDEO_CODECS = {'av1', 'h264', 'hevc', 'vp8', 'vp9'}
    AUDIO_CODECS = {'', 'aac', 'mp3', 'opus', 'vorbis'}
    SIGNATURE_BY_EXTENSION = {
        '.mkv': 'matroska',
        '.mov': 'mp4',
        '.mp4': 'mp4',
        '.webm': 'matroska',
    }
    PROBE_FORMATS_BY_SIGNATURE = {
        'mp4': {'mov', 'mp4'},
        'matroska': {'matroska', 'webm'},
    }

    @staticmethod
    def _checksum(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open('rb') as source:
            for chunk in iter(lambda: source.read(4 * 1024 * 1024), b''):
                digest.update(chunk)
        return digest.hexdigest()

    @classmethod
    def inspect(cls, *, asset_id: int, storage=None, probe=probe_media_file) -> MediaAsset:
        asset = MediaAsset.objects.get(pk=asset_id)
        if asset.is_deleted:
            raise MediaInspectionError('MEDIA_DELETED')
        if asset.status not in {
            MediaAsset.Status.INSPECTING,
            MediaAsset.Status.PROBING,
            MediaAsset.Status.PARTIALLY_PLAYABLE,
        }:
            raise MediaInspectionError('MEDIA_NOT_AWAITING_INSPECTION')
        upload = asset.upload_sessions.filter(
            status=MediaUploadSession.Status.COMPLETED,
        ).order_by('-completed_at').first()
        if upload is None:
            raise MediaInspectionError('COMPLETED_UPLOAD_NOT_FOUND')
        try:
            storage = storage or S3MultipartUploadStorage()
        except Exception as exc:
            raise MediaInspectionError('SOURCE_STORAGE_UNAVAILABLE', retryable=True) from exc

        settings.MEDIA_INSPECTION_TMP_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix='eduspace-media-inspect-',
            dir=settings.MEDIA_INSPECTION_TMP_ROOT,
        ) as temp_dir:
            source_path = Path(temp_dir).resolve() / 'source.upload'
            try:
                storage.download(object_key=upload.object_key, destination=source_path)
            except Exception as exc:
                raise MediaInspectionError('SOURCE_DOWNLOAD_FAILED', retryable=True) from exc
            if not source_path.is_file() or source_path.stat().st_size != upload.expected_size_bytes:
                raise MediaInspectionError('SOURCE_SIZE_MISMATCH')
            extension = Path(asset.original_filename).suffix.lower()
            try:
                signature = detect_container_signature(source_path)
                metadata = probe(source_path)
            except MediaProbeError as exc:
                code = str(exc) or 'MEDIA_PROBE_FAILED'
                raise MediaInspectionError(
                    code,
                    retryable=code in {'FFPROBE_NOT_AVAILABLE', 'FFPROBE_TIMEOUT'},
                ) from exc
            if cls.SIGNATURE_BY_EXTENSION.get(extension) != signature:
                raise MediaInspectionError('CONTAINER_EXTENSION_MISMATCH')
            if metadata.container not in cls.PROBE_FORMATS_BY_SIGNATURE[signature]:
                raise MediaInspectionError('CONTAINER_PROBE_MISMATCH')
            if metadata.size_bytes != upload.expected_size_bytes:
                raise MediaInspectionError('PROBED_SIZE_MISMATCH')
            if metadata.video_codec not in cls.VIDEO_CODECS:
                raise MediaInspectionError('UNSUPPORTED_VIDEO_CODEC')
            if metadata.audio_codec not in cls.AUDIO_CODECS:
                raise MediaInspectionError('UNSUPPORTED_AUDIO_CODEC')
            if metadata.duration_ms > settings.MEDIA_MAX_DURATION_SECONDS * 1000:
                raise MediaInspectionError('MEDIA_DURATION_LIMIT_EXCEEDED')
            if (
                metadata.width <= 0
                or metadata.height <= 0
                or metadata.width > settings.MEDIA_MAX_WIDTH
                or metadata.height > settings.MEDIA_MAX_HEIGHT
            ):
                raise MediaInspectionError('MEDIA_DIMENSION_LIMIT_EXCEEDED')
            checksum = cls._checksum(source_path)

        with transaction.atomic():
            locked = MediaAsset.objects.select_for_update().get(pk=asset_id)
            if locked.status not in {
                MediaAsset.Status.INSPECTING,
                MediaAsset.Status.PROBING,
                MediaAsset.Status.PARTIALLY_PLAYABLE,
            }:
                return locked
            locked.status = (
                MediaAsset.Status.PARTIALLY_PLAYABLE
                if locked.status == MediaAsset.Status.PARTIALLY_PLAYABLE
                else MediaAsset.Status.PROCESSING
            )
            locked.container = signature
            locked.video_codec = metadata.video_codec
            locked.audio_codec = metadata.audio_codec
            locked.duration_ms = metadata.duration_ms
            locked.size_bytes = metadata.size_bytes
            locked.width = metadata.width
            locked.height = metadata.height
            locked.checksum_sha256 = checksum
            locked.failure_code = ''
            locked.save(update_fields=[
                'status', 'container', 'video_codec', 'audio_codec',
                'duration_ms', 'size_bytes', 'width', 'height',
                'checksum_sha256', 'failure_code', 'updated_at',
            ])
            from media_library.tasks import transcode_media_asset_task
            transaction.on_commit(lambda: transcode_media_asset_task.delay(locked.pk))
            return locked
