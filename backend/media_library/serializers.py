from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from media_library.models import (
    MediaAsset,
    MediaRendition,
    MediaUploadSession,
    ProgressiveMediaChunk,
    ProgressiveMediaUpload,
    SharedPlaybackSession,
)


class MediaRenditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaRendition
        fields = (
            'label', 'status', 'width', 'height', 'bitrate_bps',
            'published_duration_ms', 'is_default',
        )


class MediaAssetSerializer(serializers.ModelSerializer):
    uploader_name = serializers.SerializerMethodField()
    can_start_playback = serializers.BooleanField(read_only=True)
    renditions = MediaRenditionSerializer(many=True, read_only=True)

    class Meta:
        model = MediaAsset
        fields = (
            'public_token', 'title', 'original_filename', 'status',
            'content_type', 'container', 'video_codec', 'audio_codec',
            'duration_ms', 'size_bytes', 'width', 'height', 'failure_code',
            'retention_policy', 'expires_at', 'is_deleted', 'created_at',
            'updated_at', 'uploader_name', 'can_start_playback', 'renditions',
        )
        read_only_fields = fields

    def get_uploader_name(self, asset):
        if not asset.uploader:
            return ''
        return asset.uploader.full_name or asset.uploader.username


class MediaAssetCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    original_filename = serializers.CharField(max_length=255, required=False, allow_blank=True)


class SharedPlaybackSerializer(serializers.ModelSerializer):
    asset = MediaAssetSerializer(read_only=True)
    room_code = serializers.CharField(source='room.room_code', read_only=True)
    controller_identity = serializers.SerializerMethodField()
    resumed_from_id = serializers.IntegerField(read_only=True, allow_null=True)
    expected_position_ms = serializers.SerializerMethodField()
    published_duration_ms = serializers.SerializerMethodField()
    seekable_until_ms = serializers.SerializerMethodField()
    is_growing = serializers.SerializerMethodField()
    server_now = serializers.SerializerMethodField()

    class Meta:
        model = SharedPlaybackSession
        fields = (
            'id', 'room_id', 'room_code', 'asset', 'controller_identity', 'resumed_from_id',
            'state', 'version', 'anchor_position_ms', 'expected_position_ms',
            'sync_policy', 'buffer_reason',
            'effective_at', 'playback_rate', 'published_duration_ms',
            'seekable_until_ms', 'is_growing',
            'server_now', 'started_at', 'ended_at', 'updated_at',
        )

    def get_controller_identity(self, playback):
        if not playback.controller:
            return ''
        return playback.controller.username

    def get_expected_position_ms(self, playback):
        return playback.expected_position_ms(self.context.get('server_now') or timezone.now())

    def get_published_duration_ms(self, playback):
        return playback.asset.published_duration_ms

    def get_seekable_until_ms(self, playback):
        return playback.asset.seekable_until_ms

    def get_is_growing(self, playback):
        return playback.asset.is_progressively_growing

    def get_server_now(self, playback):
        del playback
        value = self.context.get('server_now') or timezone.now()
        return value.isoformat()


class OpenSharedPlaybackSerializer(serializers.Serializer):
    asset_public_token = serializers.CharField(max_length=32)
    resumed_from_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    start_position_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)


class SharedPlaybackCommandSerializer(serializers.Serializer):
    command = serializers.ChoiceField(
        choices=('PLAY', 'PAUSE', 'SEEK', 'BUFFERING', 'STOP', 'SET_SYNC_POLICY'),
    )
    expected_version = serializers.IntegerField(min_value=1)
    position_ms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    lead_time_ms = serializers.IntegerField(required=False, min_value=0, max_value=5000, default=0)
    playback_rate = serializers.DecimalField(
        required=False,
        max_digits=4,
        decimal_places=2,
        min_value=Decimal('0.25'),
        max_value=Decimal('4.00'),
        default='1.00',
    )
    sync_policy = serializers.ChoiceField(
        choices=SharedPlaybackSession.SyncPolicy.choices,
        required=False,
    )
    buffer_reason = serializers.ChoiceField(
        choices=(
            SharedPlaybackSession.BufferReason.FRONTIER,
            SharedPlaybackSession.BufferReason.READINESS,
        ),
        required=False,
    )

    def validate(self, attrs):
        command = attrs['command']
        if command == 'SET_SYNC_POLICY' and 'sync_policy' not in attrs:
            raise serializers.ValidationError({'sync_policy': 'This field is required.'})
        if command != 'SET_SYNC_POLICY' and 'sync_policy' in attrs:
            raise serializers.ValidationError({'sync_policy': 'Only SET_SYNC_POLICY accepts this field.'})
        if command == 'BUFFERING':
            attrs.setdefault('buffer_reason', SharedPlaybackSession.BufferReason.READINESS)
        elif 'buffer_reason' in attrs:
            raise serializers.ValidationError({'buffer_reason': 'Only BUFFERING accepts this field.'})
        return attrs


class MediaUploadSessionSerializer(serializers.ModelSerializer):
    part_count = serializers.SerializerMethodField()

    class Meta:
        model = MediaUploadSession
        fields = (
            'public_token', 'status', 'expected_size_bytes', 'uploaded_bytes',
            'part_size_bytes', 'part_count', 'content_type', 'expires_at',
            'completed_at', 'created_at', 'updated_at',
        )

    def get_part_count(self, session):
        from math import ceil
        return ceil(session.expected_size_bytes / session.part_size_bytes)


class InitiateMediaUploadSerializer(serializers.Serializer):
    size_bytes = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100)


class SignMediaUploadPartSerializer(serializers.Serializer):
    part_number = serializers.IntegerField(min_value=1, max_value=10_000)


class CompletedMediaUploadPartSerializer(serializers.Serializer):
    part_number = serializers.IntegerField(min_value=1, max_value=10_000)
    etag = serializers.CharField(max_length=200, trim_whitespace=True)


class CompleteMediaUploadSerializer(serializers.Serializer):
    parts = CompletedMediaUploadPartSerializer(many=True, allow_empty=False, max_length=10_000)


class UploadedMediaPartSerializer(serializers.Serializer):
    part_number = serializers.IntegerField(min_value=1)
    etag = serializers.CharField()
    size_bytes = serializers.IntegerField(min_value=1)


class ProgressiveMediaUploadSerializer(serializers.ModelSerializer):
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = ProgressiveMediaUpload
        fields = (
            'public_token', 'status', 'compatibility', 'expected_size_bytes',
            'uploaded_bytes', 'contiguous_uploaded_bytes', 'contiguous_verified_bytes',
            'chunk_size_bytes', 'chunk_count', 'content_type', 'fallback_code',
            'ingest_failure_code', 'last_consumed_sequence', 'ingest_started_at',
            'ingest_heartbeat_at', 'ingest_finished_at',
            'expires_at', 'completed_at', 'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_chunk_count(self, upload):
        from math import ceil
        return ceil(upload.expected_size_bytes / upload.chunk_size_bytes)


class ProgressiveMediaChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressiveMediaChunk
        fields = (
            'sequence', 'expected_size_bytes', 'status', 'etag',
            'checksum_sha256', 'verified_at', 'updated_at',
        )
        read_only_fields = fields


class InitiateProgressiveUploadSerializer(serializers.Serializer):
    size_bytes = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100)


class SignProgressiveChunkSerializer(serializers.Serializer):
    sequence = serializers.IntegerField(min_value=1, max_value=10_000)


class CommitProgressiveChunkSerializer(SignProgressiveChunkSerializer):
    etag = serializers.CharField(max_length=200, trim_whitespace=True)
    checksum_sha256 = serializers.RegexField(r'^[0-9a-fA-F]{64}$')
