import hashlib
import re
import shutil
import subprocess
import tempfile
import time
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from media_library.models import (
    MediaAsset,
    MediaRendition,
    MediaUploadSession,
    ProgressiveMediaChunk,
    ProgressiveMediaUpload,
)
from media_library.services.delivery import MediaDeliveryError, MediaDeliveryService
from media_library.storage import S3MultipartUploadStorage


class ProgressiveIngestError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ProgressiveIngestService:
    LABEL = 'progressive'
    WIDTH = 640
    HEIGHT = 360
    BITRATE_BPS = 896_000

    @classmethod
    def _claim(cls, upload_id: int) -> ProgressiveMediaUpload:
        if not settings.MEDIA_PROGRESSIVE_INGEST_ENABLED:
            raise ProgressiveIngestError('PROGRESSIVE_INGEST_DISABLED')
        with transaction.atomic():
            upload = (
                ProgressiveMediaUpload.objects.select_for_update()
                .select_related('asset')
                .get(pk=upload_id)
            )
            if upload.compatibility != ProgressiveMediaUpload.Compatibility.ELIGIBLE:
                raise ProgressiveIngestError('PROGRESSIVE_INGEST_NOT_ELIGIBLE')
            if upload.ingest_finished_at is not None:
                raise ProgressiveIngestError('PROGRESSIVE_INGEST_ALREADY_FINISHED')
            if (
                upload.status == ProgressiveMediaUpload.Status.INGESTING
                and upload.ingest_heartbeat_at is not None
                and upload.ingest_heartbeat_at > timezone.now() - timedelta(
                    seconds=settings.MEDIA_PROGRESSIVE_INGEST_LEASE_SECONDS,
                )
            ):
                raise ProgressiveIngestError('PROGRESSIVE_INGEST_ALREADY_ACTIVE')
            if upload.status not in {
                ProgressiveMediaUpload.Status.UPLOADING,
                ProgressiveMediaUpload.Status.VERIFYING,
                ProgressiveMediaUpload.Status.INGESTING,
            }:
                raise ProgressiveIngestError('PROGRESSIVE_INGEST_STATE_INVALID')
            upload.ingest_attempt += 1
            upload.ingest_prefix = (
                f'media-library/{upload.asset.owner_id}/hls/{upload.asset.public_token}/'
                f'progressive-{upload.public_token}-{upload.ingest_attempt}'
            )
            upload.status = ProgressiveMediaUpload.Status.INGESTING
            upload.ingest_started_at = timezone.now()
            upload.ingest_heartbeat_at = upload.ingest_started_at
            upload.ingest_finished_at = None
            upload.ingest_failure_code = ''
            upload.last_consumed_sequence = 0
            upload.save(update_fields=[
                'ingest_attempt', 'ingest_prefix', 'status', 'ingest_started_at',
                'ingest_heartbeat_at', 'ingest_finished_at', 'ingest_failure_code',
                'last_consumed_sequence', 'updated_at',
            ])
            ProgressiveMediaChunk.objects.filter(
                upload=upload,
                status=ProgressiveMediaChunk.Status.CONSUMED,
            ).update(status=ProgressiveMediaChunk.Status.VERIFIED)
            MediaRendition.objects.update_or_create(
                asset=upload.asset,
                label=cls.LABEL,
                defaults={
                    'status': MediaRendition.Status.PROCESSING,
                    'width': cls.WIDTH,
                    'height': cls.HEIGHT,
                    'bitrate_bps': cls.BITRATE_BPS,
                    'manifest_path': '',
                    'published_duration_ms': 0,
                    'is_default': True,
                },
            )
            MediaRendition.objects.filter(asset=upload.asset).exclude(label=cls.LABEL).update(
                is_default=False,
            )
            return upload

    @staticmethod
    def _command(output_root: Path) -> list[str]:
        binary = shutil.which('ffmpeg')
        if not binary:
            raise ProgressiveIngestError('FFMPEG_NOT_AVAILABLE')
        return [
            binary, '-nostdin', '-hide_banner', '-loglevel', 'warning',
            '-fflags', '+genpts', '-i', 'pipe:0',
            '-map', '0:v:0', '-map', '0:a:0?',
            '-vf', (
                'scale=640:360:force_original_aspect_ratio=decrease,'
                'pad=640:360:(ow-iw)/2:(oh-ih)/2'
            ),
            '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
            '-pix_fmt', 'yuv420p', '-b:v', '800000', '-maxrate', '800000',
            '-bufsize', '1600000', '-force_key_frames', 'expr:gte(t,n_forced*2)',
            '-sc_threshold', '0', '-threads', str(settings.MEDIA_TRANSCODE_THREADS),
            '-c:a', 'aac', '-b:a', '96000', '-ac', '2', '-ar', '48000',
            '-f', 'hls', '-hls_time', '2', '-hls_list_size', '0',
            '-hls_playlist_type', 'event', '-hls_segment_type', 'fmp4',
            '-hls_flags', 'independent_segments+append_list+temp_file',
            '-hls_fmp4_init_filename', 'init.mp4',
            '-hls_segment_filename', str(output_root / 'segment_%06d.m4s'),
            str(output_root / 'index.m3u8'),
        ]

    @staticmethod
    def _playlist_state(path: Path):
        if not path.is_file():
            return None
        try:
            playlist = path.read_text(encoding='utf-8')
            MediaDeliveryService.rewrite_variant_playlist(
                playlist=playlist,
                segment_url=lambda filename: filename,
            )
        except (OSError, UnicodeError, MediaDeliveryError):
            # A playlist can be observed between local atomic renames. Retry the scan.
            return None
        filenames = []
        duration_ms = 0
        for line in playlist.splitlines():
            if line.startswith('#EXT-X-MAP:'):
                match = re.search(r'URI="([^"]+)"', line)
                if match:
                    filenames.append(match.group(1))
            elif line.startswith('#EXTINF:'):
                duration_ms += round(float(line.split(':', 1)[1].split(',', 1)[0]) * 1000)
            elif line and not line.startswith('#'):
                filenames.append(line)
        return playlist, filenames, duration_ms

    @classmethod
    def _publish(cls, *, upload, output_root: Path, storage, published: set[str], digest: str):
        state = cls._playlist_state(output_root / 'index.m3u8')
        if state is None:
            return digest
        playlist, filenames, duration_ms = state
        for filename in filenames:
            if filename in published:
                continue
            source = output_root / filename
            if not source.is_file():
                return digest
            storage.upload_file(
                source=source,
                object_key=f'{upload.ingest_prefix}/{cls.LABEL}/{filename}',
            )
            published.add(filename)
        next_digest = hashlib.sha256(playlist.encode('utf-8')).hexdigest()
        if next_digest == digest:
            return digest
        storage.upload_file(
            source=output_root / 'index.m3u8',
            object_key=f'{upload.ingest_prefix}/{cls.LABEL}/index.m3u8',
        )
        now = timezone.now()
        playable = duration_ms >= settings.MEDIA_PROGRESSIVE_MIN_PLAYABLE_SECONDS * 1000
        with transaction.atomic():
            rendition = MediaRendition.objects.select_for_update().get(
                asset_id=upload.asset_id,
                label=cls.LABEL,
            )
            rendition.manifest_path = f'{upload.ingest_prefix}/{cls.LABEL}/index.m3u8'
            rendition.published_duration_ms = duration_ms
            if playable:
                rendition.status = MediaRendition.Status.PLAYABLE
            rendition.save(update_fields=[
                'manifest_path', 'published_duration_ms', 'status', 'updated_at',
            ])
            asset = MediaAsset.objects.select_for_update().get(pk=upload.asset_id)
            if playable and not asset.is_deleted and asset.status in {
                MediaAsset.Status.UPLOADING,
                MediaAsset.Status.PARTIALLY_PLAYABLE,
            }:
                asset.status = MediaAsset.Status.PARTIALLY_PLAYABLE
                asset.video_codec = 'h264'
                # Audio is optional in the ingest command and cannot be trusted
                # from a client hint. Final inspection records the exact codec.
                asset.audio_codec = ''
                asset.width = cls.WIDTH
                asset.height = cls.HEIGHT
                asset.failure_code = ''
                asset.save(update_fields=[
                    'status', 'video_codec', 'audio_codec', 'width', 'height',
                    'failure_code', 'updated_at',
                ])
            ProgressiveMediaUpload.objects.filter(pk=upload.pk).update(
                ingest_heartbeat_at=now,
            )
        return next_digest

    @classmethod
    def _finish(cls, upload_id: int) -> None:
        with transaction.atomic():
            upload = (
                ProgressiveMediaUpload.objects.select_for_update()
                .select_related('asset')
                .get(pk=upload_id)
            )
            upload.ingest_finished_at = timezone.now()
            upload.ingest_heartbeat_at = upload.ingest_finished_at
            queue_inspection = upload.status == ProgressiveMediaUpload.Status.FINALIZING
            upload.status = (
                ProgressiveMediaUpload.Status.COMPLETED
                if queue_inspection
                else ProgressiveMediaUpload.Status.VERIFYING
            )
            if queue_inspection:
                upload.completed_at = upload.ingest_finished_at
            upload.save(update_fields=[
                'ingest_finished_at', 'ingest_heartbeat_at', 'status',
                'completed_at', 'updated_at',
            ])
            if queue_inspection:
                if upload.asset.status != MediaAsset.Status.PARTIALLY_PLAYABLE:
                    upload.asset.status = MediaAsset.Status.INSPECTING
                    upload.asset.save(update_fields=['status', 'updated_at'])
                from media_library.tasks import inspect_media_asset_task
                transaction.on_commit(lambda: inspect_media_asset_task.delay(upload.asset_id))

    @classmethod
    def _fallback(cls, upload_id: int, code: str) -> None:
        with transaction.atomic():
            upload = (
                ProgressiveMediaUpload.objects.select_for_update()
                .select_related('asset')
                .get(pk=upload_id)
            )
            source_ready = MediaUploadSession.objects.filter(
                asset_id=upload.asset_id,
                status=MediaUploadSession.Status.COMPLETED,
                provider_upload_id=f'progressive-compose:{upload.public_token}',
            ).exists()
            upload.compatibility = ProgressiveMediaUpload.Compatibility.INELIGIBLE
            upload.ingest_failure_code = code[:64]
            upload.fallback_code = code[:64]
            upload.ingest_finished_at = timezone.now()
            upload.status = (
                ProgressiveMediaUpload.Status.COMPLETED
                if source_ready
                else ProgressiveMediaUpload.Status.FALLBACK_REQUIRED
            )
            if source_ready:
                upload.completed_at = upload.ingest_finished_at
            upload.save(update_fields=[
                'compatibility', 'ingest_failure_code', 'fallback_code',
                'ingest_finished_at', 'status', 'completed_at', 'updated_at',
            ])
            MediaRendition.objects.filter(
                asset_id=upload.asset_id,
                label=cls.LABEL,
            ).update(status=MediaRendition.Status.FAILED)
            if source_ready:
                upload.asset.status = MediaAsset.Status.INSPECTING
                upload.asset.save(update_fields=['status', 'updated_at'])
                from media_library.tasks import inspect_media_asset_task
                transaction.on_commit(lambda: inspect_media_asset_task.delay(upload.asset_id))
            elif upload.asset.status == MediaAsset.Status.PARTIALLY_PLAYABLE:
                upload.asset.status = MediaAsset.Status.UPLOADING
                upload.asset.save(update_fields=['status', 'updated_at'])

    @classmethod
    def ingest(cls, *, upload_id: int, storage=None) -> ProgressiveMediaUpload:
        upload = cls._claim(upload_id)
        storage = storage or S3MultipartUploadStorage()
        settings.MEDIA_INSPECTION_TMP_ROOT.mkdir(parents=True, exist_ok=True)
        process = None
        try:
            with tempfile.TemporaryDirectory(
                prefix='eduspace-progressive-ingest-',
                dir=settings.MEDIA_INSPECTION_TMP_ROOT,
            ) as temp_dir:
                output_root = Path(temp_dir).resolve() / cls.LABEL
                output_root.mkdir(parents=True)
                stderr_path = Path(temp_dir).resolve() / 'ffmpeg.stderr'
                with stderr_path.open('wb') as stderr:
                    process = subprocess.Popen(
                        cls._command(output_root),
                        stdin=subprocess.PIPE,
                        stdout=subprocess.DEVNULL,
                        stderr=stderr,
                    )
                    if process.stdin is None:
                        raise ProgressiveIngestError('FFMPEG_STDIN_UNAVAILABLE')
                    published = set()
                    playlist_digest = ''
                    sequence = 1
                    count = (upload.expected_size_bytes + upload.chunk_size_bytes - 1) // upload.chunk_size_bytes
                    deadline = time.monotonic() + settings.MEDIA_PROGRESSIVE_INGEST_TIMEOUT_SECONDS
                    while sequence <= count:
                        if time.monotonic() >= deadline:
                            raise ProgressiveIngestError('PROGRESSIVE_INGEST_TIMEOUT')
                        if process.poll() is not None:
                            raise ProgressiveIngestError('FFMPEG_PROGRESSIVE_INGEST_FAILED')
                        chunk = ProgressiveMediaChunk.objects.filter(
                            upload_id=upload.pk,
                            sequence=sequence,
                            status__in=[
                                ProgressiveMediaChunk.Status.VERIFIED,
                                ProgressiveMediaChunk.Status.CONSUMED,
                            ],
                        ).first()
                        if chunk is None:
                            current = ProgressiveMediaUpload.objects.only('status', 'expires_at').get(pk=upload.pk)
                            if current.status in {
                                ProgressiveMediaUpload.Status.ABORTED,
                                ProgressiveMediaUpload.Status.FAILED,
                            } or current.expires_at <= timezone.now():
                                raise ProgressiveIngestError('PROGRESSIVE_UPLOAD_ENDED_DURING_INGEST')
                            playlist_digest = cls._publish(
                                upload=upload, output_root=output_root, storage=storage,
                                published=published, digest=playlist_digest,
                            )
                            ProgressiveMediaUpload.objects.filter(pk=upload.pk).update(
                                ingest_heartbeat_at=timezone.now(),
                            )
                            time.sleep(settings.MEDIA_PROGRESSIVE_INGEST_POLL_SECONDS)
                            continue
                        try:
                            for payload in storage.iter_bytes(object_key=chunk.object_key):
                                process.stdin.write(payload)
                                process.stdin.flush()
                                playlist_digest = cls._publish(
                                    upload=upload, output_root=output_root, storage=storage,
                                    published=published, digest=playlist_digest,
                                )
                        except (BrokenPipeError, OSError) as exc:
                            raise ProgressiveIngestError('FFMPEG_PROGRESSIVE_INGEST_FAILED') from exc
                        ProgressiveMediaChunk.objects.filter(pk=chunk.pk).update(
                            status=ProgressiveMediaChunk.Status.CONSUMED,
                        )
                        ProgressiveMediaUpload.objects.filter(pk=upload.pk).update(
                            last_consumed_sequence=sequence,
                            ingest_heartbeat_at=timezone.now(),
                        )
                        sequence += 1
                    process.stdin.close()
                    while process.poll() is None:
                        playlist_digest = cls._publish(
                            upload=upload, output_root=output_root, storage=storage,
                            published=published, digest=playlist_digest,
                        )
                        if time.monotonic() >= deadline:
                            process.terminate()
                            raise ProgressiveIngestError('PROGRESSIVE_INGEST_TIMEOUT')
                        time.sleep(0.2)
                    playlist_digest = cls._publish(
                        upload=upload, output_root=output_root, storage=storage,
                        published=published, digest=playlist_digest,
                    )
                    if process.returncode != 0 or not playlist_digest:
                        raise ProgressiveIngestError('FFMPEG_PROGRESSIVE_INGEST_FAILED')
            cls._finish(upload.pk)
        except Exception as exc:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            code = exc.code if isinstance(exc, ProgressiveIngestError) else 'PROGRESSIVE_INGEST_FAILED'
            cls._fallback(upload.pk, code)
            if isinstance(exc, ProgressiveIngestError):
                raise
            raise ProgressiveIngestError(code) from exc
        return ProgressiveMediaUpload.objects.get(pk=upload.pk)
