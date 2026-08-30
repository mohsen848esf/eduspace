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


def _mark_inspection_failed(asset_id: int, code: str) -> None:
    MediaAsset.objects.filter(
        pk=asset_id,
        status__in=[
            MediaAsset.Status.INSPECTING,
            MediaAsset.Status.PROBING,
            MediaAsset.Status.PARTIALLY_PLAYABLE,
        ],
    ).update(status=MediaAsset.Status.FAILED, failure_code=code[:64])


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


def _mark_transcode_failed(asset_id: int, code: str) -> None:
    MediaAsset.objects.filter(
        pk=asset_id,
        status=MediaAsset.Status.PROCESSING,
    ).update(status=MediaAsset.Status.FAILED, failure_code=code[:64])
    from media_library.models import MediaRendition
    MediaRendition.objects.filter(
        asset_id=asset_id,
        status=MediaRendition.Status.PROCESSING,
    ).update(status=MediaRendition.Status.FAILED)


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
