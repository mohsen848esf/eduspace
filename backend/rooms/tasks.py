import logging
import shutil
from pathlib import Path
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.utils import timezone
from accounts.metrics import CELERY_TASKS_TOTAL
from rooms.models import Recording, RecordingSegment
from rooms.recording import ffmpeg_ops
from rooms.recording.s3_utils import upload_recording_to_s3

logger = logging.getLogger(__name__)


@shared_task(
    name="rooms.tasks.finalize_client_recording_task",
    soft_time_limit=1800,
    time_limit=1900,
)
def finalize_client_recording_task(recording_pk: int):
    """
    Concatenates client WebM chunks, transcodes them to standard MP4 (720p or 1080p),
    optionally generates a downscaled 720p version if original is 1080p,
    and uploads to S3/MinIO if enabled.
    """
    try:
        recording = Recording.objects.get(pk=recording_pk)
        recording_token = recording.public_token
        chunks_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording_token / 'chunks'
        
        if not chunks_dir.exists():
            raise FileNotFoundError(f"Chunks directory {chunks_dir} does not exist")

        # Find and sort chunks by index
        chunk_files = sorted(
            chunks_dir.glob('chunk_*.webm'),
            key=lambda p: int(p.name.split('_')[1].split('.')[0])
        )
        if not chunk_files:
            raise FileNotFoundError(f"No chunks found in {chunks_dir}")

        recording_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording_token
        recording_dir.mkdir(parents=True, exist_ok=True)
        
        # Primary output MP4
        final_mp4_path = recording_dir / 'final.mp4'

        # 1. Transcode and concat WebM files to MP4 (original quality)
        ffmpeg_ops.concat_webm_to_mp4(chunk_files, final_mp4_path)

        # Probe the output file
        probe_result = ffmpeg_ops.probe(final_mp4_path)
        
        # 2. Handle multi-quality outputs if S3 or local storage is used
        quality = recording.quality
        quality_files = {}

        if quality == '1080p':
            # Store 1080p version
            fhd_path = recording_dir / 'final_1080p.mp4'
            shutil.copy(final_mp4_path, fhd_path)
            quality_files['1080p'] = fhd_path

            # Generate downscaled 720p version
            hd_path = recording_dir / 'final_720p.mp4'
            ffmpeg_ops.transcode_and_trim(
                source_path=final_mp4_path,
                output_path=hd_path,
                height=720,
                start_seconds=0.0
            )
            quality_files['720p'] = hd_path
        else:
            # 720p original quality
            hd_path = recording_dir / 'final_720p.mp4'
            shutil.copy(final_mp4_path, hd_path)
            quality_files['720p'] = hd_path

        # 3. Handle S3 Uploads
        if getattr(settings, 'S3_ENABLED', False):
            # Upload final.mp4
            upload_recording_to_s3(final_mp4_path, f"{recording_token}/final.mp4")
            
            # Upload quality-specific files
            for q, path in quality_files.items():
                upload_recording_to_s3(path, f"{recording_token}/final_{q}.mp4")

            # Clean up local final files if S3 is enabled to save space
            try:
                final_mp4_path.unlink()
                for path in quality_files.values():
                    path.unlink()
            except OSError as e:
                logger.warning("Failed to clean up local finalized files: %s", e)

        # Update database fields
        recording.file_path = f'{recording_token}/final.mp4'
        recording.duration_seconds = int(round(probe_result.duration_seconds))
        recording.size_bytes = probe_result.size_bytes
        recording.status = Recording.Status.COMPLETED
        recording.completed_at = timezone.now()
        recording.save(update_fields=[
            'file_path', 'duration_seconds', 'size_bytes', 'status', 'completed_at'
        ])

        # Clean up chunk directory
        try:
            shutil.rmtree(chunks_dir)
        except OSError as e:
            logger.warning("Failed to remove chunks directory %s: %s", chunks_dir, e)

        logger.info("Successfully finalized client-side recording %s via Celery task", recording_token)
        CELERY_TASKS_TOTAL.labels(task_name="finalize_client_recording_task", status="success").inc()
        return f"Client recording {recording_token} completed"
    except SoftTimeLimitExceeded as e:
        logger.error("Soft time limit exceeded in finalize_client_recording_task for pk=%s", recording_pk)
        CELERY_TASKS_TOTAL.labels(task_name="finalize_client_recording_task", status="failure").inc()
        try:
            rec = Recording.objects.get(pk=recording_pk)
            rec.status = Recording.Status.FAILED
            rec.save(update_fields=['status'])
            
            # Clean up any partial output
            rec_dir = Path(settings.RECORDING_OUTPUT_DIR) / rec.public_token
            if rec_dir.exists():
                shutil.rmtree(rec_dir, ignore_errors=True)
        except Exception:
            pass
        raise e
    except Exception as e:
        logger.exception("Failed to run finalize_client_recording_task")
        CELERY_TASKS_TOTAL.labels(task_name="finalize_client_recording_task", status="failure").inc()
        try:
            rec = Recording.objects.get(pk=recording_pk)
            rec.status = Recording.Status.FAILED
            rec.save(update_fields=['status'])
        except Exception:
            pass
        raise e


@shared_task(
    name="rooms.tasks.finalize_recording_task",
    soft_time_limit=1800,
    time_limit=1900,
)
def finalize_recording_task(recording_pk: int, trim_start: float, trim_end: float | None):
    """
    Stitches server-side RoomCompositeEgress segments, applies optional trim boundaries,
    and downscales to 720p if the original quality is 1080p.
    Uploads finalized files to S3 if enabled.
    """
    try:
        rec = Recording.objects.get(pk=recording_pk)
        recording_token = rec.public_token
        recording_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording_token

        # Collect segment paths (in order)
        segments = list(rec.segments.exclude(file_path='').order_by('index'))
        if not segments:
            raise FileNotFoundError("No segment files available to finalize")

        seg_paths = [
            settings.RECORDING_OUTPUT_DIR / s.file_path for s in segments
        ]
        
        # Verify segment files exist
        missing = [str(p) for p in seg_paths if not p.exists()]
        if missing:
            raise FileNotFoundError(f"Some segment files are missing on the server: {missing}")

        final_path = recording_dir / 'final.mp4'
        final_path.parent.mkdir(parents=True, exist_ok=True)
        intermediate_path = final_path.with_suffix('.concat.mp4')

        # 1. Concatenate segments
        ffmpeg_ops.concat_segments(seg_paths, intermediate_path)

        # 2. Sanity-check trim bounds
        probe = ffmpeg_ops.probe(intermediate_path)
        actual_end = trim_end
        if actual_end is not None and actual_end > probe.duration_seconds:
            actual_end = probe.duration_seconds
        if trim_start >= probe.duration_seconds:
            raise ValueError(f"trim_start_seconds ({trim_start}) is past the recording end ({probe.duration_seconds:.2f}s)")

        # 3. Apply trim to final.mp4
        ffmpeg_ops.trim_inplace(
            intermediate_path,
            final_path,
            start_seconds=trim_start,
            end_seconds=actual_end,
        )

        # Clean up intermediate file
        if intermediate_path.exists() and intermediate_path != final_path:
            try:
                intermediate_path.unlink()
            except OSError:
                pass

        # Re-probe trimmed file
        final_probe = ffmpeg_ops.probe(final_path)

        # 4. Generate quality-specific files
        quality = rec.quality
        quality_files = {}

        if quality == '1080p':
            # Store 1080p version
            fhd_path = recording_dir / 'final_1080p.mp4'
            shutil.copy(final_path, fhd_path)
            quality_files['1080p'] = fhd_path

            # Generate downscaled 720p version
            hd_path = recording_dir / 'final_720p.mp4'
            ffmpeg_ops.transcode_and_trim(
                source_path=final_path,
                output_path=hd_path,
                height=720,
                start_seconds=0.0
            )
            quality_files['720p'] = hd_path
        else:
            # 720p original quality
            hd_path = recording_dir / 'final_720p.mp4'
            shutil.copy(final_path, hd_path)
            quality_files['720p'] = hd_path

        # 5. Handle S3 Uploads
        if getattr(settings, 'S3_ENABLED', False):
            # Upload final.mp4
            upload_recording_to_s3(final_path, f"{recording_token}/final.mp4")
            
            # Upload quality-specific files
            for q, path in quality_files.items():
                upload_recording_to_s3(path, f"{recording_token}/final_{q}.mp4")

            # Clean up local final files if S3 is enabled
            try:
                final_path.unlink()
                for path in quality_files.values():
                    path.unlink()
            except OSError as e:
                logger.warning("Failed to clean up local finalized files: %s", e)

        # Update database fields
        rec.file_path = f'{recording_token}/final.mp4'
        rec.duration_seconds = int(round(final_probe.duration_seconds))
        rec.size_bytes = final_probe.size_bytes
        rec.trim_start_seconds = trim_start
        rec.trim_end_seconds = actual_end
        rec.status = Recording.Status.COMPLETED
        rec.completed_at = timezone.now()
        rec.save(update_fields=[
            'file_path', 'duration_seconds', 'size_bytes',
            'trim_start_seconds', 'trim_end_seconds', 'status', 'completed_at'
        ])

        logger.info("Successfully finalized server-side recording %s via Celery task", recording_token)
        CELERY_TASKS_TOTAL.labels(task_name="finalize_recording_task", status="success").inc()
        return f"Server recording {recording_token} finalized"
    except SoftTimeLimitExceeded as e:
        logger.error("Soft time limit exceeded in finalize_recording_task for pk=%s", recording_pk)
        CELERY_TASKS_TOTAL.labels(task_name="finalize_recording_task", status="failure").inc()
        try:
            recording = Recording.objects.get(pk=recording_pk)
            recording.status = Recording.Status.FAILED
            recording.save(update_fields=['status'])
            
            # Clean up any partial output
            rec_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording.public_token
            if rec_dir.exists():
                shutil.rmtree(rec_dir, ignore_errors=True)
        except Exception:
            pass
        raise e
    except Exception as e:
        logger.exception("Failed to run finalize_recording_task")
        CELERY_TASKS_TOTAL.labels(task_name="finalize_recording_task", status="failure").inc()
        try:
            recording = Recording.objects.get(pk=recording_pk)
            recording.status = Recording.Status.FAILED
            recording.save(update_fields=['status'])
        except Exception:
            pass
        raise e
