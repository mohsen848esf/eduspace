import math
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from media_library.models import MediaAsset, MediaUploadSession
from media_library.storage import S3MultipartUploadStorage


ALLOWED_VIDEO_TYPES = {
    '.mkv': {'video/x-matroska', 'application/octet-stream'},
    '.mov': {'video/quicktime'},
    '.mp4': {'video/mp4'},
    '.webm': {'video/webm'},
}


class MediaUploadService:
    @staticmethod
    def _require_owner(asset, actor):
        if not actor or not actor.is_authenticated or asset.owner_id != actor.id:
            raise PermissionDenied('Only the media owner can upload this source.')

    @classmethod
    def initiate(cls, *, asset, actor, size_bytes: int, content_type: str, storage=None):
        cls._require_owner(asset, actor)
        extension = Path(asset.original_filename).suffix.lower()
        if extension not in ALLOWED_VIDEO_TYPES or content_type not in ALLOWED_VIDEO_TYPES[extension]:
            raise ValidationError('The declared video type does not match an allowed file extension.')
        if size_bytes <= 0 or size_bytes > settings.MEDIA_UPLOAD_MAX_SIZE_BYTES:
            raise ValidationError('The video size is outside the configured upload limit.')
        active = asset.upload_sessions.filter(
            status__in=[MediaUploadSession.Status.INITIATED, MediaUploadSession.Status.UPLOADING],
        ).first()
        storage = storage or S3MultipartUploadStorage()
        if active:
            if active.expires_at > timezone.now():
                raise ValidationError('This media asset already has an active upload.')
            storage.abort(
                object_key=active.object_key,
                provider_upload_id=active.provider_upload_id,
            )
            active.status = MediaUploadSession.Status.ABORTED
            active.save(update_fields=['status', 'updated_at'])
        object_key = f'media-library/{asset.owner_id}/source/{uuid.uuid4().hex}.upload'
        provider_upload_id = storage.initiate(object_key=object_key, content_type=content_type)
        try:
            with transaction.atomic():
                locked = MediaAsset.objects.select_for_update().get(pk=asset.pk)
                cls._require_owner(locked, actor)
                session = MediaUploadSession.objects.create(
                    asset=locked,
                    provider_upload_id=provider_upload_id,
                    object_key=object_key,
                    expected_size_bytes=size_bytes,
                    part_size_bytes=settings.MEDIA_UPLOAD_PART_SIZE_BYTES,
                    content_type=content_type,
                    expires_at=timezone.now() + timedelta(
                        seconds=settings.MEDIA_UPLOAD_SESSION_TTL_SECONDS,
                    ),
                )
                locked.size_bytes = size_bytes
                locked.content_type = content_type
                locked.status = MediaAsset.Status.UPLOADING
                locked.save(update_fields=['size_bytes', 'content_type', 'status', 'updated_at'])
                return session
        except (IntegrityError, PermissionDenied, ValidationError):
            storage.abort(object_key=object_key, provider_upload_id=provider_upload_id)
            raise

    @classmethod
    def sign_part(cls, *, session, actor, part_number: int, storage=None):
        cls._require_owner(session.asset, actor)
        if session.status not in {
            MediaUploadSession.Status.INITIATED,
            MediaUploadSession.Status.UPLOADING,
        } or session.expires_at <= timezone.now():
            raise ValidationError('The upload session is not active.')
        part_count = math.ceil(session.expected_size_bytes / session.part_size_bytes)
        if part_number < 1 or part_number > part_count or part_number > 10_000:
            raise ValidationError('Part number is outside this upload session.')
        storage = storage or S3MultipartUploadStorage()
        url = storage.sign_part(
            object_key=session.object_key,
            provider_upload_id=session.provider_upload_id,
            part_number=part_number,
        )
        if session.status == MediaUploadSession.Status.INITIATED:
            session.status = MediaUploadSession.Status.UPLOADING
            session.save(update_fields=['status', 'updated_at'])
        return url

    @classmethod
    def resume_state(cls, *, session, actor, storage=None):
        cls._require_owner(session.asset, actor)
        if session.status not in {
            MediaUploadSession.Status.INITIATED,
            MediaUploadSession.Status.UPLOADING,
        } or session.expires_at <= timezone.now():
            raise ValidationError('The upload session is not active.')
        storage = storage or S3MultipartUploadStorage()
        parts = storage.list_parts(
            object_key=session.object_key,
            provider_upload_id=session.provider_upload_id,
        )
        uploaded_bytes = sum(part['size_bytes'] for part in parts)
        fields = []
        if session.uploaded_bytes != uploaded_bytes:
            session.uploaded_bytes = uploaded_bytes
            fields.append('uploaded_bytes')
        if parts and session.status == MediaUploadSession.Status.INITIATED:
            session.status = MediaUploadSession.Status.UPLOADING
            fields.append('status')
        if fields:
            session.save(update_fields=[*fields, 'updated_at'])
        return session, parts

    @classmethod
    def complete(cls, *, session, actor, parts: list[dict], storage=None):
        cls._require_owner(session.asset, actor)
        if session.status not in {
            MediaUploadSession.Status.INITIATED,
            MediaUploadSession.Status.UPLOADING,
        } or session.expires_at <= timezone.now():
            raise ValidationError('The upload session is not active.')
        numbers = [part['PartNumber'] for part in parts]
        if not parts or numbers != sorted(set(numbers)):
            raise ValidationError('Completed parts must be unique and sorted.')
        storage = storage or S3MultipartUploadStorage()
        actual_size = storage.complete(
            object_key=session.object_key,
            provider_upload_id=session.provider_upload_id,
            parts=parts,
        )
        if actual_size != session.expected_size_bytes:
            storage.delete(object_key=session.object_key)
            session.status = MediaUploadSession.Status.FAILED
            session.save(update_fields=['status', 'updated_at'])
            raise ValidationError('Uploaded object size does not match the declared size.')
        with transaction.atomic():
            locked = MediaUploadSession.objects.select_for_update().select_related('asset').get(pk=session.pk)
            locked.status = MediaUploadSession.Status.COMPLETED
            locked.uploaded_bytes = actual_size
            locked.completed_at = timezone.now()
            locked.save(update_fields=['status', 'uploaded_bytes', 'completed_at', 'updated_at'])
            locked.asset.status = MediaAsset.Status.INSPECTING
            locked.asset.save(update_fields=['status', 'updated_at'])
            from media_library.tasks import inspect_media_asset_task
            transaction.on_commit(lambda: inspect_media_asset_task.delay(locked.asset_id))
        return locked
