import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings

from media_library.models import MediaAsset
from media_library.services.inspection import MediaInspectionError, MediaInspectionService
from media_library.services.transcoding import MediaTranscodeError, MediaTranscodeService
from media_library.services.progressive_uploads import ProgressiveUploadError, ProgressiveUploadService
from media_library.services.progressive_ingest import ProgressiveIngestError, ProgressiveIngestService


logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='media_library.tasks.ingest_progressive_media_upload_task',
    max_retries=3,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=18_000,
    time_limit=18_300,
)
def ingest_progressive_media_upload_task(self, upload_id: int):
    try:
        upload = ProgressiveIngestService.ingest(upload_id=upload_id)
        return f'Progressive media upload {upload.pk} ingested'
    except ProgressiveIngestError as exc:
        if (
            exc.code == 'PROGRESSIVE_INGEST_ALREADY_ACTIVE'
            and self.request.retries < 3
        ):
            raise self.retry(
                exc=exc,
                countdown=settings.MEDIA_PROGRESSIVE_INGEST_LEASE_SECONDS,
                max_retries=3,
            )
        return f'Progressive media upload {upload_id} fell back: {exc.code}'


@shared_task(
    bind=True,
    name='media_library.tasks.verify_progressive_media_chunk_task',
    max_retries=2,
    soft_time_limit=300,
    time_limit=330,
)
def verify_progressive_media_chunk_task(self, chunk_id: int):
    try:
        chunk = ProgressiveUploadService.verify_chunk(chunk_id=chunk_id)
        return f'Progressive media chunk {chunk.pk} verified'
    except ProgressiveUploadError as exc:
        if exc.code in {'PROGRESSIVE_CHUNK_NOT_UPLOADED'}:
            return f'Progressive media chunk {chunk_id} skipped: {exc.code}'
        return f'Progressive media chunk {chunk_id} rejected: {exc.code}'
    except SoftTimeLimitExceeded:
        raise
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=10 * (self.request.retries + 1))
        logger.exception('Unexpected progressive chunk verification failure chunk=%s', chunk_id)
        raise


def _requeue_purge_if_deleted(asset_id: int) -> None:
    """Deletion already enqueues a purge as soon as it happens, but a task
    that was already mid-flight can still finish uploading a rendition (or
    get cut off) after that first purge already ran. Re-enqueueing here
    (safe: purge is idempotent) closes that race instead of relying on
    perfect timing.
    """
    if MediaAsset.objects.filter(pk=asset_id, is_deleted=True).exists():
        purge_deleted_media_asset_task.delay(asset_id)


def _mark_inspection_failed(asset_id: int, code: str) -> None:
    MediaAsset.objects.filter(
        pk=asset_id,
        status__in=[
            MediaAsset.Status.INSPECTING,
            MediaAsset.Status.PROBING,
            MediaAsset.Status.PARTIALLY_PLAYABLE,
        ],
    ).update(status=MediaAsset.Status.FAILED, failure_code=code[:64])
    _requeue_purge_if_deleted(asset_id)


@shared_task(
    bind=True,
    name='media_library.tasks.inspect_media_asset_task',
    max_retries=2,
    soft_time_limit=300,
    time_limit=330,
)
def inspect_media_asset_task(self, asset_id: int):
    claimed = MediaAsset.objects.filter(
        pk=asset_id,
        status=MediaAsset.Status.INSPECTING,
        is_deleted=False,
    ).update(status=MediaAsset.Status.PROBING, failure_code='')
    if not claimed and not MediaAsset.objects.filter(
        pk=asset_id,
        status__in=[MediaAsset.Status.PROBING, MediaAsset.Status.PARTIALLY_PLAYABLE],
        is_deleted=False,
    ).exists():
        return f'Media asset {asset_id} is not awaiting inspection'
    MediaAsset.objects.filter(pk=asset_id).update(active_task_id=self.request.id or '')
    try:
        asset = MediaInspectionService.inspect(asset_id=asset_id)
        return f'Media asset {asset.pk} inspected'
    except MediaInspectionError as exc:
        if exc.retryable and self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=10 * (self.request.retries + 1))
        _mark_inspection_failed(asset_id, exc.code)
        return f'Media asset {asset_id} rejected: {exc.code}'
    except SoftTimeLimitExceeded:
        _mark_inspection_failed(asset_id, 'INSPECTION_TIMEOUT')
        raise
    except Exception:
        _mark_inspection_failed(asset_id, 'INSPECTION_FAILED')
        logger.exception('Unexpected media inspection failure for asset=%s', asset_id)
        raise
    finally:
        MediaAsset.objects.filter(pk=asset_id, active_task_id=self.request.id or '').update(active_task_id='')


def _mark_transcode_failed(asset_id: int, code: str) -> None:
    from media_library.models import MediaRendition
    MediaRendition.objects.filter(
        asset_id=asset_id,
        status=MediaRendition.Status.PROCESSING,
    ).update(status=MediaRendition.Status.FAILED)
    MediaAsset.objects.filter(
        pk=asset_id,
        status=MediaAsset.Status.PROCESSING,
    ).update(status=MediaAsset.Status.FAILED, failure_code=code[:64])
    # A later rendition (e.g. the 720p rung) can fail after an earlier one
    # (e.g. Original) already published and moved the asset to
    # PARTIALLY_PLAYABLE. Don't discard the rendition that already works by
    # downgrading to FAILED — but do record the failure so it's visible
    # instead of leaving the asset silently stuck here forever.
    MediaAsset.objects.filter(
        pk=asset_id,
        status=MediaAsset.Status.PARTIALLY_PLAYABLE,
    ).update(failure_code=code[:64])
    _requeue_purge_if_deleted(asset_id)


@shared_task(
    bind=True,
    name='media_library.tasks.transcode_media_asset_task',
    max_retries=2,
    soft_time_limit=7500,
    time_limit=7600,
)
def transcode_media_asset_task(self, asset_id: int):
    if not MediaAsset.objects.filter(
        pk=asset_id,
        status__in=[MediaAsset.Status.PROCESSING, MediaAsset.Status.PARTIALLY_PLAYABLE],
        is_deleted=False,
    ).exists():
        return f'Media asset {asset_id} is not awaiting transcode'
    MediaAsset.objects.filter(pk=asset_id).update(active_task_id=self.request.id or '')
    try:
        asset = MediaTranscodeService.transcode(asset_id=asset_id)
        return f'Media asset {asset.pk} transcoded'
    except MediaTranscodeError as exc:
        if exc.retryable and self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))
        _mark_transcode_failed(asset_id, exc.code)
        return f'Media asset {asset_id} transcode failed: {exc.code}'
    except SoftTimeLimitExceeded:
        _mark_transcode_failed(asset_id, 'TRANSCODE_TIMEOUT')
        raise
    except Exception:
        _mark_transcode_failed(asset_id, 'TRANSCODE_FAILED')
        logger.exception('Unexpected media transcode failure for asset=%s', asset_id)
        raise
    finally:
        MediaAsset.objects.filter(pk=asset_id, active_task_id=self.request.id or '').update(active_task_id='')


@shared_task(
    bind=True,
    name='media_library.tasks.purge_deleted_media_asset_task',
    max_retries=3,
    soft_time_limit=120,
    time_limit=150,
)
def purge_deleted_media_asset_task(self, asset_id: int):
    """Free the object storage a deleted asset was using.

    Runs after mark_deleted (and again, harmlessly, after a still-in-flight
    inspect/transcode task notices the deletion and unwinds) — it never
    happened automatically before this, so deleted assets kept their source
    file and any encoded renditions in storage forever.
    """
    from media_library.models import ProgressiveMediaUpload
    from media_library.storage import S3MultipartUploadStorage

    try:
        asset = MediaAsset.objects.get(pk=asset_id)
    except MediaAsset.DoesNotExist:
        return f'Media asset {asset_id} no longer exists'
    if not asset.is_deleted:
        return f'Media asset {asset_id} is not deleted; skipping purge'

    try:
        storage = S3MultipartUploadStorage()
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))
        logger.exception('Could not reach object storage to purge media asset=%s', asset_id)
        return f'Media asset {asset_id} purge failed: storage unavailable'

    errors = []
    for upload in asset.upload_sessions.exclude(object_key=''):
        try:
            storage.delete(object_key=upload.object_key)
        except Exception as exc:  # noqa: BLE001 - best-effort cleanup, collect and continue
            errors.append(str(exc))
    for progressive in ProgressiveMediaUpload.objects.filter(asset=asset).exclude(object_prefix=''):
        try:
            storage.delete_prefix(object_prefix=progressive.object_prefix)
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
    try:
        storage.delete_prefix(object_prefix=f'media-library/{asset.owner_id}/hls/{asset.public_token}')
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))

    if errors:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=RuntimeError('; '.join(errors)), countdown=30 * (self.request.retries + 1))
        logger.error('Media asset %s purge finished with errors: %s', asset_id, errors)
        return f'Media asset {asset_id} purge finished with errors'
    return f'Media asset {asset_id} storage purged'
