from django.contrib import admin

from media_library.models import (
    MediaAsset,
    MediaRendition,
    MediaUploadSession,
    ProgressiveMediaChunk,
    ProgressiveMediaUpload,
    SharedPlaybackSession,
)


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'status', 'duration_ms', 'is_deleted', 'created_at')
    list_filter = ('status', 'retention_policy', 'is_deleted')
    search_fields = ('title', 'original_filename', 'public_token')


@admin.register(MediaRendition)
class MediaRenditionAdmin(admin.ModelAdmin):
    list_display = ('asset', 'label', 'status', 'published_duration_ms', 'is_default')
    list_filter = ('status', 'label', 'is_default')


@admin.register(SharedPlaybackSession)
class SharedPlaybackSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'asset', 'state', 'version', 'anchor_position_ms', 'started_at', 'ended_at')
    list_filter = ('state',)
    search_fields = ('asset__title', 'asset__public_token', 'room__room_code')


@admin.register(MediaUploadSession)
class MediaUploadSessionAdmin(admin.ModelAdmin):
    list_display = ('public_token', 'asset', 'status', 'expected_size_bytes', 'created_at')
    list_filter = ('status',)
    search_fields = ('public_token', 'asset__title', 'asset__public_token')


@admin.register(ProgressiveMediaUpload)
class ProgressiveMediaUploadAdmin(admin.ModelAdmin):
    list_display = (
        'public_token', 'asset', 'status', 'compatibility',
        'contiguous_verified_bytes', 'last_consumed_sequence',
        'expected_size_bytes', 'ingest_heartbeat_at', 'created_at',
    )
    list_filter = ('status', 'compatibility')
    search_fields = ('public_token', 'asset__title', 'asset__public_token')


@admin.register(ProgressiveMediaChunk)
class ProgressiveMediaChunkAdmin(admin.ModelAdmin):
    list_display = ('upload', 'sequence', 'status', 'expected_size_bytes', 'verified_at')
    list_filter = ('status',)
    search_fields = ('upload__public_token', 'object_key', 'checksum_sha256')
