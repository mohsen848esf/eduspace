"""
ffmpeg helpers for recording finalization.

`ffmpeg-python` is a thin wrapper around the ffmpeg CLI; for the two
operations we need (concat + trim, both stream-copy) the simpler raw
subprocess approach is more predictable and the error surface is
clearer, so we shell out directly. ffmpeg is expected to be on PATH.

All paths must be absolute (or resolved relative to MEDIA_ROOT before
being passed in). All operations are synchronous and return when the
file is fully written; callers that need progress should run them in
a worker.
"""

from __future__ import annotations

import json
import logging
import shlex
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


class FFmpegError(RuntimeError):
    """Raised when ffmpeg / ffprobe exits with a non-zero status."""


@dataclass(frozen=True)
class ProbeResult:
    duration_seconds: float
    size_bytes: int
    has_audio: bool
    has_video: bool


def _which(binary: str) -> str:
    """Locate ffmpeg/ffprobe; raise FFmpegError if missing."""
    found = shutil.which(binary)
    if not found:
        raise FFmpegError(
            f'{binary} is not on PATH. Install it via `winget install Gyan.FFmpeg` '
            'or your package manager and reopen the shell.'
        )
    return found


def _run(cmd: list[str]) -> str:
    """Run a command, capturing combined output. Raises FFmpegError on failure."""
    logger.debug('exec: %s', shlex.join(cmd))
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise FFmpegError(
            f'{cmd[0]} exited {proc.returncode}: {proc.stderr.strip()[:500]}'
        )
    return proc.stdout


def probe(path: Path) -> ProbeResult:
    """Return basic metadata for a media file."""
    ffprobe = _which('ffprobe')
    out = _run([
        ffprobe,
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        str(path),
    ])
    data = json.loads(out)
    streams = data.get('streams') or []
    fmt = data.get('format') or {}
    duration = float(fmt.get('duration') or 0.0)
    size = int(fmt.get('size') or 0)
    has_audio = any(s.get('codec_type') == 'audio' for s in streams)
    has_video = any(s.get('codec_type') == 'video' for s in streams)
    return ProbeResult(
        duration_seconds=duration,
        size_bytes=size,
        has_audio=has_audio,
        has_video=has_video,
    )


def concat_segments(
    segment_paths: Iterable[Path],
    output_path: Path,
) -> None:
    """
    Stream-copy concat using ffmpeg's concat demuxer. Inputs must share
    the same codec / sample rate / pixel format. RoomCompositeEgress
    always emits identical settings within one recording, so this works
    reliably for our pause/resume case.
    """
    paths = [Path(p) for p in segment_paths]
    if not paths:
        raise FFmpegError('concat_segments needs at least one input')
    for p in paths:
        if not p.exists():
            raise FFmpegError(f'segment missing: {p}')

    if len(paths) == 1:
        # Trivial case: copy the lone segment to the destination so the
        # caller can rely on output_path existing.
        shutil.copy2(paths[0], output_path)
        return

    ffmpeg = _which('ffmpeg')
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # ffmpeg concat demuxer needs a list-file with one `file '/abs/path'` per line.
    with tempfile.NamedTemporaryFile(
        mode='w', suffix='.txt', delete=False, encoding='utf-8',
    ) as listf:
        for p in paths:
            # ffmpeg's concat list format escapes ' as '\''
            escaped = str(p.resolve()).replace("'", "'\\''")
            listf.write(f"file '{escaped}'\n")
        list_path = Path(listf.name)

    try:
        _run([
            ffmpeg,
            '-y',  # overwrite without prompting
            '-hide_banner',
            '-loglevel', 'error',
            '-f', 'concat',
            '-safe', '0',
            '-i', str(list_path),
            '-c', 'copy',
            '-movflags', '+faststart',
            str(output_path),
        ])
    finally:
        try:
            list_path.unlink()
        except OSError:
            pass


def trim_inplace(
    source_path: Path,
    output_path: Path,
    start_seconds: float,
    end_seconds: Optional[float] = None,
) -> None:
    """
    Trim with stream copy (no re-encode). end_seconds is exclusive.
    If start_seconds is 0 and end_seconds is None we shortcut to a copy
    so the caller doesn't have to special-case "no trim requested".
    """
    if start_seconds < 0:
        raise FFmpegError(f'start_seconds must be >= 0, got {start_seconds}')
    if end_seconds is not None and end_seconds <= start_seconds:
        raise FFmpegError(
            f'end_seconds ({end_seconds}) must be greater than start_seconds ({start_seconds})'
        )

    if start_seconds == 0 and end_seconds is None:
        if source_path.resolve() != output_path.resolve():
            shutil.copy2(source_path, output_path)
        return

    ffmpeg = _which('ffmpeg')
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg,
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        # `-ss` before `-i` is the fast/imprecise seek; combined with `-c copy`
        # it lands on the nearest keyframe. Acceptable for end-user trims.
        '-ss', f'{start_seconds:.3f}',
        '-i', str(source_path),
    ]
    if end_seconds is not None:
        # `-to` is wallclock (relative to original 0); switch to `-t`
        # which is duration after the seek.
        cmd += ['-t', f'{end_seconds - start_seconds:.3f}']
    cmd += [
        '-c', 'copy',
        '-movflags', '+faststart',
        str(output_path),
    ]
    _run(cmd)
