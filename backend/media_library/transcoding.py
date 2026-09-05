import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


class MediaTranscodeCommandError(RuntimeError):
    pass


@dataclass(frozen=True)
class HlsProfile:
    label: str
    width: int
    height: int
    video_bitrate_bps: int
    audio_bitrate_bps: int


def remux_hls_source(*, source: Path, output_root: Path, has_audio: bool, audio_bitrate_bps: int = 128_000) -> None:
    """Package an H.264 source at its original quality without re-encoding video.

    The audio track is always transcoded to AAC (HLS delivery requires it),
    even when the source uses a different codec (Opus, MP3, ...) — this is
    cheap relative to a full video re-encode, since only the audio stream is
    touched.
    """
    binary = shutil.which('ffmpeg')
    if not binary:
        raise MediaTranscodeCommandError('FFMPEG_NOT_AVAILABLE')
    rendition_root = (output_root / 'source').resolve()
    rendition_root.mkdir(parents=True, exist_ok=True)
    command = [
        binary, '-nostdin', '-hide_banner', '-loglevel', 'error',
        '-i', str(source.resolve()), '-map', '0:v:0',
    ]
    if has_audio:
        command.extend(['-map', '0:a:0'])
    command.extend(['-c:v', 'copy'])
    if has_audio:
        command.extend([
            '-c:a', 'aac',
            '-b:a', str(audio_bitrate_bps),
            '-ac', '2',
            '-ar', '48000',
        ])
    command.extend([
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'fmp4',
        '-hls_flags', 'independent_segments',
        '-hls_fmp4_init_filename', 'init.mp4',
        '-hls_segment_filename', 'segment_%06d.m4s',
        'index.m3u8',
    ])
    try:
        process = subprocess.run(
            command,
            capture_output=True,
            check=False,
            timeout=settings.MEDIA_TRANSCODE_TIMEOUT_SECONDS,
            cwd=rendition_root,
        )
    except subprocess.TimeoutExpired as exc:
        raise MediaTranscodeCommandError('FFMPEG_TIMEOUT') from exc
    if process.returncode != 0:
        raise MediaTranscodeCommandError('FFMPEG_REMUX_FAILED')


def transcode_hls_renditions(
    *,
    source: Path,
    output_root: Path,
    profiles: list[HlsProfile],
    has_audio: bool,
) -> None:
    binary = shutil.which('ffmpeg')
    if not binary:
        raise MediaTranscodeCommandError('FFMPEG_NOT_AVAILABLE')
    source = source.resolve()
    for profile in profiles:
        rendition_root = (output_root / profile.label).resolve()
        rendition_root.mkdir(parents=True, exist_ok=True)
        command = [
            binary,
            '-nostdin',
            '-hide_banner',
            '-loglevel', 'error',
            '-i', str(source),
            '-map', '0:v:0',
        ]
        if has_audio:
            command.extend(['-map', '0:a:0'])
        command.extend([
            '-vf', f'scale={profile.width}:{profile.height}:flags=lanczos',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-profile:v', 'main',
            '-pix_fmt', 'yuv420p',
            '-b:v', str(profile.video_bitrate_bps),
            '-maxrate', str(profile.video_bitrate_bps),
            '-bufsize', str(profile.video_bitrate_bps * 2),
            '-force_key_frames', 'expr:gte(t,n_forced*2)',
            '-sc_threshold', '0',
            '-threads', str(settings.MEDIA_TRANSCODE_THREADS),
        ])
        if has_audio:
            command.extend([
                '-c:a', 'aac',
                '-b:a', str(profile.audio_bitrate_bps),
                '-ac', '2',
                '-ar', '48000',
            ])
        command.extend([
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_playlist_type', 'vod',
            '-hls_segment_type', 'fmp4',
            '-hls_flags', 'independent_segments',
            '-hls_fmp4_init_filename', 'init.mp4',
            '-hls_segment_filename', 'segment_%06d.m4s',
            'index.m3u8',
        ])
        try:
            process = subprocess.run(
                command,
                capture_output=True,
                check=False,
                timeout=settings.MEDIA_TRANSCODE_TIMEOUT_SECONDS,
                cwd=rendition_root,
            )
        except subprocess.TimeoutExpired as exc:
            raise MediaTranscodeCommandError('FFMPEG_TIMEOUT') from exc
        if process.returncode != 0:
            raise MediaTranscodeCommandError('FFMPEG_TRANSCODE_FAILED')
