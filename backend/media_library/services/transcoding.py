import tempfile
from pathlib import Path

from django.conf import settings
from django.db import transaction

from media_library.models import MediaAsset, MediaRendition, MediaUploadSession
from media_library.services.delivery import MediaDeliveryError, MediaDeliveryService
from media_library.storage import S3MultipartUploadStorage
from media_library.transcoding import (
    HlsProfile,
    MediaTranscodeCommandError,
    remux_hls_source,
    transcode_hls_renditions,
)


class MediaTranscodeError(RuntimeError):
    def __init__(self, code: str, *, retryable: bool = False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


class MediaTranscodeService:
    DOWNSCALE_HEIGHT = 720
    DOWNSCALE_BITRATES_BPS = (2_800_000, 128_000)

    @staticmethod
    def _even_width(source_width: int, source_height: int, target_height: int) -> int:
        return max(2, int(source_width * target_height / source_height) // 2 * 2)

    @classmethod
    def profiles_for(cls, asset: MediaAsset) -> list[HlsProfile]:
        """The downscaled rung for weaker connections. Original quality is
        handled separately in transcode() — it's always attempted, regardless
        of resolution, so it isn't part of this ladder. Skipped entirely when
        the source is already at or below the downscale target: there is
        nothing to downscale to.
        """
        if asset.height <= cls.DOWNSCALE_HEIGHT:
            return []
        video_bitrate, audio_bitrate = cls.DOWNSCALE_BITRATES_BPS
        return [HlsProfile(
            label=f'{cls.DOWNSCALE_HEIGHT}p',
            width=cls._even_width(asset.width, asset.height, cls.DOWNSCALE_HEIGHT),
            height=cls.DOWNSCALE_HEIGHT,
            video_bitrate_bps=video_bitrate,
            audio_bitrate_bps=audio_bitrate,
        )]

    @staticmethod
    def _write_master_playlist(*, output_root: Path, profiles: list[HlsProfile], has_audio: bool):
        codecs = 'avc1.4d401f,mp4a.40.2' if has_audio else 'avc1.4d401f'
        lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']
        for profile in profiles:
            bandwidth = profile.video_bitrate_bps + (profile.audio_bitrate_bps if has_audio else 0)
            lines.extend([
                (
                    f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},'
                    f'RESOLUTION={profile.width}x{profile.height},CODECS="{codecs}"'
                ),
                f'{profile.label}/index.m3u8',
            ])
        (output_root / 'master.m3u8').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    @staticmethod
    def _validate_rendition_outputs(output_root: Path, profiles: list[HlsProfile]) -> None:
        for profile in profiles:
            root = output_root / profile.label
            if not (root / 'index.m3u8').is_file() or not (root / 'init.mp4').is_file():
                raise MediaTranscodeError('HLS_RENDITION_INCOMPLETE')
            if not next(root.glob('segment_*.m4s'), None):
                raise MediaTranscodeError('HLS_SEGMENTS_MISSING')
            try:
                playlist = (root / 'index.m3u8').read_text(encoding='utf-8')
                if len(playlist.encode('utf-8')) > 1_000_000:
                    raise MediaDeliveryError('INVALID_HLS_MANIFEST')
                if 'URI="init.mp4"' not in playlist or 'segment_' not in playlist:
                    raise MediaDeliveryError('INVALID_HLS_MANIFEST')
                MediaDeliveryService.rewrite_variant_playlist(
                    playlist=playlist,
                    segment_url=lambda filename: filename,
                )
            except (OSError, UnicodeError, MediaDeliveryError) as exc:
                raise MediaTranscodeError('INVALID_HLS_MANIFEST') from exc

    @classmethod
    def _publish_playable_rendition(
        cls,
        *,
        asset_id: int,
        profile: HlsProfile,
        prefix: str,
    ) -> None:
        """Publish the first completed quality without waiting for later qualities."""
        with transaction.atomic():
            locked = MediaAsset.objects.select_for_update().get(pk=asset_id)
            if locked.is_deleted or locked.status not in {
                MediaAsset.Status.PROCESSING,
                MediaAsset.Status.PARTIALLY_PLAYABLE,
            }:
                raise MediaTranscodeError('MEDIA_STATE_CHANGED_DURING_TRANSCODE')
            MediaRendition.objects.filter(asset=locked, label=profile.label).update(
                status=MediaRendition.Status.PLAYABLE,
                manifest_path=f'{prefix}/{profile.label}/index.m3u8',
                published_duration_ms=locked.duration_ms,
            )
            locked.status = MediaAsset.Status.PARTIALLY_PLAYABLE
            locked.failure_code = ''
            locked.save(update_fields=['status', 'failure_code', 'updated_at'])

    @classmethod
    def transcode(
        cls,
        *,
        asset_id: int,
        storage=None,
        transcoder=transcode_hls_renditions,
        remuxer=remux_hls_source,
    ) -> MediaAsset:
        asset = MediaAsset.objects.get(pk=asset_id)
        if asset.is_deleted or asset.status not in {
            MediaAsset.Status.PROCESSING,
            MediaAsset.Status.PARTIALLY_PLAYABLE,
        }:
            raise MediaTranscodeError('MEDIA_NOT_AWAITING_TRANSCODE')
        if not asset.checksum_sha256 or not asset.duration_ms or not asset.height:
            raise MediaTranscodeError('MEDIA_INSPECTION_METADATA_MISSING')
        upload = asset.upload_sessions.filter(
            status=MediaUploadSession.Status.COMPLETED,
        ).order_by('-completed_at').first()
        if upload is None:
            raise MediaTranscodeError('COMPLETED_UPLOAD_NOT_FOUND')
        profiles = cls.profiles_for(asset)

        def cancel_check() -> bool:
            return MediaAsset.objects.filter(pk=asset_id, is_deleted=True).exists()

        prefix = (
            f'media-library/{asset.owner_id}/hls/{asset.public_token}/'
            f'{asset.checksum_sha256[:16]}'
        )
        profiles_to_process = []
        for profile in profiles:
            rendition, _ = MediaRendition.objects.get_or_create(
                asset=asset,
                label=profile.label,
                defaults={
                    'status': MediaRendition.Status.PROCESSING,
                    'width': profile.width,
                    'height': profile.height,
                    'bitrate_bps': profile.video_bitrate_bps + profile.audio_bitrate_bps,
                    'manifest_path': '',
                    'published_duration_ms': 0,
                    'is_default': False,
                },
            )
            if (
                rendition.status in {MediaRendition.Status.PLAYABLE, MediaRendition.Status.READY}
                and rendition.manifest_path
                and rendition.published_duration_ms > 0
            ):
                continue
            rendition.status = MediaRendition.Status.PROCESSING
            rendition.width = profile.width
            rendition.height = profile.height
            rendition.bitrate_bps = profile.video_bitrate_bps + profile.audio_bitrate_bps
            rendition.manifest_path = ''
            rendition.published_duration_ms = 0
            rendition.is_default = False
            rendition.save(update_fields=[
                'status', 'width', 'height', 'bitrate_bps', 'manifest_path',
                'published_duration_ms', 'is_default', 'updated_at',
            ])
            profiles_to_process.append(profile)
        try:
            storage = storage or S3MultipartUploadStorage()
        except Exception as exc:
            raise MediaTranscodeError('TRANSCODE_STORAGE_UNAVAILABLE', retryable=True) from exc

        settings.MEDIA_INSPECTION_TMP_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix='eduspace-media-transcode-',
            dir=settings.MEDIA_INSPECTION_TMP_ROOT,
        ) as temp_dir:
            root = Path(temp_dir).resolve()
            source = root / 'source.upload'
            output = root / 'hls'
            output.mkdir()
            try:
                storage.download(object_key=upload.object_key, destination=source)
            except Exception as exc:
                raise MediaTranscodeError('TRANSCODE_SOURCE_DOWNLOAD_FAILED', retryable=True) from exc
            if not source.is_file() or source.stat().st_size != upload.expected_size_bytes:
                raise MediaTranscodeError('TRANSCODE_SOURCE_SIZE_MISMATCH')
            source_published = False
            if remuxer is not None:
                # Original quality is always attempted, for any source codec.
                # H.264 sources get a fast lossless remux (video copy, audio
                # transcoded to AAC if needed). Everything else needs a real
                # re-encode at the source's own resolution — slower, but this
                # is the only way to normalize an incompatible codec (HEVC,
                # VP9, AV1, ...) to something browsers can play at all.
                is_remux_eligible = asset.video_codec == 'h264'
                source_profile = HlsProfile(
                    label='source',
                    width=asset.width,
                    height=asset.height,
                    video_bitrate_bps=max(
                        1,
                        int(asset.size_bytes * 8 / max(1, asset.duration_ms / 1000)),
                    ),
                    audio_bitrate_bps=128_000 if asset.audio_codec else 0,
                )
                source_rendition, _ = MediaRendition.objects.get_or_create(
                    asset=asset,
                    label='source',
                    defaults={
                        'status': MediaRendition.Status.PROCESSING,
                        'width': source_profile.width,
                        'height': source_profile.height,
                        'bitrate_bps': source_profile.video_bitrate_bps,
                        'is_default': True,
                    },
                )
                if source_rendition.status in {
                    MediaRendition.Status.PLAYABLE,
                    MediaRendition.Status.READY,
                }:
                    source_published = True
                else:
                    try:
                        if is_remux_eligible:
                            remuxer(
                                source=source, output_root=output,
                                has_audio=bool(asset.audio_codec), cancel_check=cancel_check,
                            )
                        else:
                            transcoder(
                                source=source,
                                output_root=output,
                                profiles=[source_profile],
                                has_audio=bool(asset.audio_codec),
                                cancel_check=cancel_check,
                            )
                        cls._validate_rendition_outputs(output, [source_profile])
                        storage.upload_tree(
                            source_root=output / source_profile.label,
                            object_prefix=f'{prefix}/{source_profile.label}',
                        )
                        cls._publish_playable_rendition(
                            asset_id=asset_id,
                            profile=source_profile,
                            prefix=prefix,
                        )
                        source_published = True
                    except Exception as exc:
                        MediaRendition.objects.filter(
                            asset_id=asset_id,
                            label='source',
                            status=MediaRendition.Status.PROCESSING,
                        ).update(status=MediaRendition.Status.FAILED)
                        code = str(exc) if isinstance(exc, MediaTranscodeCommandError) else 'ORIGINAL_RENDITION_FAILED'
                        if code == 'CANCELLED':
                            raise MediaTranscodeError(code, retryable=False) from exc
                        if not profiles_to_process:
                            # No downscaled rung either — without Original,
                            # this asset would have nothing playable at all.
                            raise MediaTranscodeError(code, retryable=is_remux_eligible) from exc
            for profile in profiles_to_process:
                if cancel_check():
                    raise MediaTranscodeError('CANCELLED', retryable=False)
                try:
                    transcoder(
                        source=source,
                        output_root=output,
                        profiles=[profile],
                        has_audio=bool(asset.audio_codec),
                        cancel_check=cancel_check,
                    )
                except MediaTranscodeCommandError as exc:
                    code = str(exc) or 'FFMPEG_TRANSCODE_FAILED'
                    raise MediaTranscodeError(
                        code,
                        retryable=code in {'FFMPEG_NOT_AVAILABLE', 'FFMPEG_TIMEOUT'},
                    ) from exc
                cls._validate_rendition_outputs(output, [profile])
                try:
                    storage.upload_tree(
                        source_root=output / profile.label,
                        object_prefix=f'{prefix}/{profile.label}',
                    )
                except Exception as exc:
                    raise MediaTranscodeError('HLS_UPLOAD_FAILED', retryable=True) from exc
                cls._publish_playable_rendition(
                    asset_id=asset_id,
                    profile=profile,
                    prefix=prefix,
                )
            cls._write_master_playlist(
                output_root=output,
                profiles=([source_profile] if source_published else []) + profiles,
                has_audio=bool(asset.audio_codec),
            )
            try:
                storage.upload_tree(source_root=output, object_prefix=prefix)
            except Exception as exc:
                raise MediaTranscodeError('HLS_UPLOAD_FAILED', retryable=True) from exc

        with transaction.atomic():
            locked = MediaAsset.objects.select_for_update().get(pk=asset_id)
            if locked.is_deleted or locked.status != MediaAsset.Status.PARTIALLY_PLAYABLE:
                raise MediaTranscodeError('MEDIA_STATE_CHANGED_DURING_TRANSCODE')
            for profile in profiles:
                MediaRendition.objects.filter(asset=locked, label=profile.label).update(
                    status=MediaRendition.Status.READY,
                    manifest_path=f'{prefix}/{profile.label}/index.m3u8',
                    published_duration_ms=locked.duration_ms,
                )
            MediaRendition.objects.filter(
                asset=locked,
                status=MediaRendition.Status.PLAYABLE,
            ).update(status=MediaRendition.Status.READY)
            locked.master_manifest_path = f'{prefix}/master.m3u8'
            locked.status = MediaAsset.Status.READY
            locked.failure_code = ''
            locked.save(update_fields=[
                'master_manifest_path', 'status', 'failure_code', 'updated_at',
            ])
            return locked
