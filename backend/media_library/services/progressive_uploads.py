import math
import re
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from media_library.models import (
    MediaAsset,
    MediaUploadSession,
    ProgressiveMediaChunk,
    ProgressiveMediaUpload,
)
from media_library.progressive import classify_mp4_prefix
from media_library.storage import S3MultipartUploadStorage


class ProgressiveUploadError(RuntimeError):
    def __init__(self, code: str, message: str, *, status_code: int = 409):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class ProgressiveUploadService:
    ACTIVE_STATUSES = {
        ProgressiveMediaUpload.Status.INITIATED,
        ProgressiveMediaUpload.Status.UPLOADING,
        ProgressiveMediaUpload.Status.VERIFYING,
        ProgressiveMediaUpload.Status.INGESTING,
        ProgressiveMediaUpload.Status.FINALIZING,
        ProgressiveMediaUpload.Status.FALLBACK_REQUIRED,
    }

    @staticmethod
    def capabilities() -> dict:
        enabled = bool(settings.MEDIA_PROGRESSIVE_UPLOAD_ENABLED)
        live_ingest = enabled and bool(settings.MEDIA_PROGRESSIVE_INGEST_ENABLED)
        return {
            'enabled': enabled,
            'implementation_stage': (
                'live_ingest_pilot' if live_ingest
                else 'verified_chunk_upload' if enabled
                else 'disabled'
            ),
            'play_while_uploading': live_ingest,
            'supported_content_types': ['video/mp4'],
            'chunk_size_bytes': settings.MEDIA_PROGRESSIVE_CHUNK_SIZE_BYTES,
            'prefix_probe_bytes': settings.MEDIA_PROGRESSIVE_PREFIX_PROBE_BYTES,
        }

    @staticmethod
    def _require_enabled():
        if not settings.MEDIA_PROGRESSIVE_UPLOAD_ENABLED:
            raise ProgressiveUploadError(
                'PROGRESSIVE_UPLOAD_DISABLED',
                'Progressive media upload is not enabled.',
            )

    @staticmethod
    def _require_owner(upload_or_asset, actor):
        asset = getattr(upload_or_asset, 'asset', upload_or_asset)
        if not actor or not actor.is_authenticated or asset.owner_id != actor.id:
            raise PermissionDenied('Only the media owner can manage this upload.')

    @staticmethod
    def chunk_count(upload) -> int:
        return math.ceil(upload.expected_size_bytes / upload.chunk_size_bytes)

    @classmethod
    def expected_chunk_size(cls, upload, sequence: int) -> int:
        count = cls.chunk_count(upload)
        if sequence < 1 or sequence > count or sequence > 10_000:
            raise ValidationError('Chunk sequence is outside this upload session.')
        if sequence < count:
            return upload.chunk_size_bytes
        return upload.expected_size_bytes - (count - 1) * upload.chunk_size_bytes

    @classmethod
    def _require_active(cls, upload):
        if upload.status not in cls.ACTIVE_STATUSES or upload.expires_at <= timezone.now():
            raise ProgressiveUploadError('PROGRESSIVE_UPLOAD_NOT_ACTIVE', 'The upload is not active.')

    @classmethod
    def initiate(cls, *, asset, actor, size_bytes: int, content_type: str):
        cls._require_enabled()
        cls._require_owner(asset, actor)
        if Path(asset.original_filename).suffix.lower() != '.mp4' or content_type != 'video/mp4':
            raise ValidationError('Progressive upload currently supports MP4 video only.')
        if size_bytes <= 0 or size_bytes > settings.MEDIA_UPLOAD_MAX_SIZE_BYTES:
            raise ValidationError('The video size is outside the configured upload limit.')
        if asset.upload_sessions.filter(
            status__in=[MediaUploadSession.Status.INITIATED, MediaUploadSession.Status.UPLOADING],
        ).exists():
            raise ValidationError('This media asset already has an active multipart upload.')
        prefix = f'media-library/{asset.owner_id}/progressive/{uuid.uuid4().hex}'
        try:
            with transaction.atomic():
                locked = MediaAsset.objects.select_for_update().get(pk=asset.pk)
                upload = ProgressiveMediaUpload.objects.create(
                    asset=locked,
                    expected_size_bytes=size_bytes,
                    chunk_size_bytes=settings.MEDIA_PROGRESSIVE_CHUNK_SIZE_BYTES,
                    content_type=content_type,
                    object_prefix=prefix,
                    expires_at=timezone.now() + timedelta(
                        seconds=settings.MEDIA_UPLOAD_SESSION_TTL_SECONDS,
                    ),
                )
                locked.size_bytes = size_bytes
                locked.content_type = content_type
                locked.status = MediaAsset.Status.UPLOADING
                locked.save(update_fields=['size_bytes', 'content_type', 'status', 'updated_at'])
                return upload
        except IntegrityError as exc:
            raise ValidationError('This media asset already has an active progressive upload.') from exc

    @classmethod
    def sign_chunk(cls, *, upload, actor, sequence: int, storage=None):
        cls._require_enabled()
        cls._require_owner(upload, actor)
        cls._require_active(upload)
        expected_size = cls.expected_chunk_size(upload, sequence)
        object_key = f'{upload.object_prefix}/{sequence:08d}.bin'
        chunk, _ = ProgressiveMediaChunk.objects.get_or_create(
            upload=upload,
            sequence=sequence,
            defaults={'object_key': object_key, 'expected_size_bytes': expected_size},
        )
        if chunk.status in {ProgressiveMediaChunk.Status.VERIFIED, ProgressiveMediaChunk.Status.CONSUMED}:
            raise ValidationError('This chunk is already verified.')
        storage = storage or S3MultipartUploadStorage()
        url = storage.sign_put_object(object_key=chunk.object_key)
        if upload.status == ProgressiveMediaUpload.Status.INITIATED:
            upload.status = ProgressiveMediaUpload.Status.UPLOADING
            upload.save(update_fields=['status', 'updated_at'])
        return chunk, url

    @staticmethod
    def _normalise_etag(value: str) -> str:
        return value.strip().strip('"').lower()

    @classmethod
    def _update_frontiers(cls, upload):
        chunks = list(upload.chunks.order_by('sequence'))
        uploaded = sum(
            chunk.expected_size_bytes for chunk in chunks
            if chunk.status in {
                ProgressiveMediaChunk.Status.UPLOADED,
                ProgressiveMediaChunk.Status.VERIFIED,
                ProgressiveMediaChunk.Status.CONSUMED,
            }
        )
        contiguous_uploaded = 0
        contiguous_verified = 0
        expected_sequence = 1
        for chunk in chunks:
            if chunk.sequence != expected_sequence or chunk.status not in {
                ProgressiveMediaChunk.Status.UPLOADED,
                ProgressiveMediaChunk.Status.VERIFIED,
                ProgressiveMediaChunk.Status.CONSUMED,
            }:
                break
            contiguous_uploaded += chunk.expected_size_bytes
            expected_sequence += 1
        expected_sequence = 1
        for chunk in chunks:
            if chunk.sequence != expected_sequence or chunk.status not in {
                ProgressiveMediaChunk.Status.VERIFIED,
                ProgressiveMediaChunk.Status.CONSUMED,
            }:
                break
            contiguous_verified += chunk.expected_size_bytes
            expected_sequence += 1
        ProgressiveMediaUpload.objects.filter(pk=upload.pk).update(
            uploaded_bytes=uploaded,
            contiguous_uploaded_bytes=contiguous_uploaded,
            contiguous_verified_bytes=contiguous_verified,
        )
        upload.refresh_from_db()
        return upload

    @classmethod
    def commit_chunk(cls, *, upload, actor, sequence: int, etag: str, checksum_sha256: str, storage=None):
        cls._require_enabled()
        cls._require_owner(upload, actor)
        cls._require_active(upload)
        if not re.fullmatch(r'[0-9a-fA-F]{64}', checksum_sha256):
            raise ValidationError('Chunk SHA-256 checksum is invalid.')
        chunk = upload.chunks.filter(sequence=sequence).first()
        if chunk is None:
            raise ValidationError('Sign the chunk before committing it.')
        if chunk.status in {ProgressiveMediaChunk.Status.VERIFIED, ProgressiveMediaChunk.Status.CONSUMED}:
            if (
                chunk.checksum_sha256 == checksum_sha256.lower()
                and cls._normalise_etag(chunk.etag) == cls._normalise_etag(etag)
            ):
                return chunk
            raise ValidationError('This chunk is already verified with different metadata.')
        storage = storage or S3MultipartUploadStorage()
        metadata = storage.head(object_key=chunk.object_key)
        if metadata['size_bytes'] != chunk.expected_size_bytes:
            raise ProgressiveUploadError('PROGRESSIVE_CHUNK_SIZE_MISMATCH', 'Chunk size does not match.')
        if cls._normalise_etag(metadata['etag']) != cls._normalise_etag(etag):
            raise ProgressiveUploadError('PROGRESSIVE_CHUNK_ETAG_MISMATCH', 'Chunk ETag does not match.')
        with transaction.atomic():
            locked = ProgressiveMediaChunk.objects.select_for_update().get(pk=chunk.pk)
            locked.status = ProgressiveMediaChunk.Status.UPLOADED
            locked.etag = cls._normalise_etag(etag)
            locked.checksum_sha256 = checksum_sha256.lower()
            locked.save(update_fields=['status', 'etag', 'checksum_sha256', 'updated_at'])
            ProgressiveMediaUpload.objects.filter(
                pk=upload.pk,
                status__in=[
                    ProgressiveMediaUpload.Status.INITIATED,
                    ProgressiveMediaUpload.Status.UPLOADING,
                    ProgressiveMediaUpload.Status.VERIFYING,
                ],
            ).update(status=ProgressiveMediaUpload.Status.VERIFYING)
            cls._update_frontiers(upload)
            from media_library.tasks import verify_progressive_media_chunk_task
            transaction.on_commit(lambda: verify_progressive_media_chunk_task.delay(locked.pk))
        return locked

    @classmethod
    def verify_chunk(cls, *, chunk_id: int, storage=None):
        chunk = ProgressiveMediaChunk.objects.select_related('upload').get(pk=chunk_id)
        if chunk.status == ProgressiveMediaChunk.Status.VERIFIED:
            return chunk
        if chunk.status != ProgressiveMediaChunk.Status.UPLOADED:
            raise ProgressiveUploadError('PROGRESSIVE_CHUNK_NOT_UPLOADED', 'Chunk is not awaiting verification.')
        storage = storage or S3MultipartUploadStorage()
        actual_checksum = storage.stream_sha256(object_key=chunk.object_key)
        if actual_checksum.lower() != chunk.checksum_sha256.lower():
            ProgressiveMediaChunk.objects.filter(pk=chunk.pk).update(status=ProgressiveMediaChunk.Status.FAILED)
            ProgressiveMediaUpload.objects.filter(pk=chunk.upload_id).update(
                status=ProgressiveMediaUpload.Status.FAILED,
                fallback_code='CHUNK_CHECKSUM_MISMATCH',
            )
            raise ProgressiveUploadError('PROGRESSIVE_CHUNK_CHECKSUM_MISMATCH', 'Chunk checksum does not match.')
        compatibility = None
        if chunk.sequence == 1:
            prefix = storage.read_prefix(
                object_key=chunk.object_key,
                max_bytes=settings.MEDIA_PROGRESSIVE_PREFIX_PROBE_BYTES,
            )
            compatibility = classify_mp4_prefix(prefix)
        with transaction.atomic():
            locked = ProgressiveMediaChunk.objects.select_for_update().select_related('upload').get(pk=chunk.pk)
            locked.status = ProgressiveMediaChunk.Status.VERIFIED
            locked.verified_at = timezone.now()
            locked.save(update_fields=['status', 'verified_at', 'updated_at'])
            upload = locked.upload
            fields = []
            if compatibility is not None:
                upload.compatibility = (
                    ProgressiveMediaUpload.Compatibility.ELIGIBLE
                    if compatibility.eligible
                    else ProgressiveMediaUpload.Compatibility.INELIGIBLE
                )
                upload.fallback_code = '' if compatibility.eligible else compatibility.code
                fields.extend(['compatibility', 'fallback_code'])
                if not compatibility.eligible:
                    upload.status = ProgressiveMediaUpload.Status.FALLBACK_REQUIRED
                    fields.append('status')
            if fields:
                upload.save(update_fields=[*fields, 'updated_at'])
            cls._update_frontiers(upload)
            if (
                compatibility is not None
                and compatibility.eligible
                and settings.MEDIA_PROGRESSIVE_INGEST_ENABLED
            ):
                from media_library.tasks import ingest_progressive_media_upload_task
                transaction.on_commit(lambda: ingest_progressive_media_upload_task.delay(upload.pk))
        return locked

    @classmethod
    def finalize(cls, *, upload, actor, storage=None):
        cls._require_enabled()
        cls._require_owner(upload, actor)
        cls._require_active(upload)
        if upload.status == ProgressiveMediaUpload.Status.FINALIZING:
            raise ProgressiveUploadError('PROGRESSIVE_UPLOAD_FINALIZING', 'The upload is already finalizing.')
        chunks = list(upload.chunks.order_by('sequence'))
        if len(chunks) != cls.chunk_count(upload) or any(
            chunk.sequence != index or chunk.status not in {
                ProgressiveMediaChunk.Status.VERIFIED,
                ProgressiveMediaChunk.Status.CONSUMED,
            }
            for index, chunk in enumerate(chunks, start=1)
        ):
            raise ProgressiveUploadError('PROGRESSIVE_UPLOAD_INCOMPLETE', 'Every chunk must be verified first.')
        live_ingest_active = (
            upload.status == ProgressiveMediaUpload.Status.INGESTING
            and upload.ingest_finished_at is None
        )
        upload.status = ProgressiveMediaUpload.Status.FINALIZING
        upload.save(update_fields=['status', 'updated_at'])
        target_key = f'media-library/{upload.asset.owner_id}/source/{uuid.uuid4().hex}.upload'
        storage = storage or S3MultipartUploadStorage()
        actual_size = storage.compose_objects(
            source_keys=[chunk.object_key for chunk in chunks],
            target_key=target_key,
            content_type=upload.content_type,
        )
        if actual_size != upload.expected_size_bytes:
            storage.delete(object_key=target_key)
            upload.status = ProgressiveMediaUpload.Status.FAILED
            upload.fallback_code = 'COMPOSED_SOURCE_SIZE_MISMATCH'
            upload.save(update_fields=['status', 'fallback_code', 'updated_at'])
            raise ProgressiveUploadError('COMPOSED_SOURCE_SIZE_MISMATCH', 'Composed source size does not match.')
        with transaction.atomic():
            locked = ProgressiveMediaUpload.objects.select_for_update().select_related('asset').get(pk=upload.pk)
            now = timezone.now()
            MediaUploadSession.objects.create(
                asset=locked.asset,
                status=MediaUploadSession.Status.COMPLETED,
                provider_upload_id=f'progressive-compose:{locked.public_token}',
                object_key=target_key,
                expected_size_bytes=actual_size,
                uploaded_bytes=actual_size,
                part_size_bytes=locked.chunk_size_bytes,
                content_type=locked.content_type,
                expires_at=locked.expires_at,
                completed_at=now,
            )
            wait_for_ingest = live_ingest_active and locked.ingest_finished_at is None
            if not wait_for_ingest:
                locked.status = ProgressiveMediaUpload.Status.COMPLETED
                locked.completed_at = now
            locked.save(update_fields=['status', 'completed_at', 'updated_at'])
            if not wait_for_ingest:
                if locked.asset.status != MediaAsset.Status.PARTIALLY_PLAYABLE:
                    locked.asset.status = MediaAsset.Status.INSPECTING
                    locked.asset.save(update_fields=['status', 'updated_at'])
                from media_library.tasks import inspect_media_asset_task
                transaction.on_commit(lambda: inspect_media_asset_task.delay(locked.asset_id))
        return locked
