import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

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


def _terminate(process: subprocess.Popen) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def _run_ffmpeg(
    command: list[str],
    *,
    cwd: Path,
    timeout: int,
    failure_code: str,
    cancel_check: Optional[Callable[[], bool]] = None,
    poll_interval: float = 1.0,
) -> None:
    """Run an ffmpeg command, polling so it can be cancelled mid-run.

    A plain blocking subprocess.run() call can't be interrupted once
    started, so a deleted asset's encode would keep the CPU pinned until
    ffmpeg finished on its own. Polling with a short timeout on wait() lets
    cancel_check() (and the overall timeout) be re-checked every
    poll_interval seconds instead.
    """
    try:
        process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as exc:
        raise MediaTranscodeCommandError('FFMPEG_NOT_AVAILABLE') from exc
    deadline = time.monotonic() + timeout
    while True:
        try:
            process.wait(timeout=poll_interval)
            break
        except subprocess.TimeoutExpired:
            if cancel_check is not None and cancel_check():
                _terminate(process)
                raise MediaTranscodeCommandError('CANCELLED')
            if time.monotonic() >= deadline:
                _terminate(process)
                raise MediaTranscodeCommandError('FFMPEG_TIMEOUT')
    if process.returncode != 0:
        raise MediaTranscodeCommandError(failure_code)


def remux_hls_source(
    *,
    source: Path,
    output_root: Path,
    has_audio: bool,
    audio_bitrate_bps: int = 128_000,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> None:
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
    _run_ffmpeg(
        command,
        cwd=rendition_root,
        timeout=settings.MEDIA_TRANSCODE_TIMEOUT_SECONDS,
        failure_code='FFMPEG_REMUX_FAILED',
        cancel_check=cancel_check,
    )


def transcode_hls_renditions(
    *,
    source: Path,
    output_root: Path,
    profiles: list[HlsProfile],
    has_audio: bool,
    cancel_check: Optional[Callable[[], bool]] = None,
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
        _run_ffmpeg(
            command,
            cwd=rendition_root,
            timeout=settings.MEDIA_TRANSCODE_TIMEOUT_SECONDS,
            failure_code='FFMPEG_TRANSCODE_FAILED',
            cancel_check=cancel_check,
        )
