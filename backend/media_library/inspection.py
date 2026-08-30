import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


class MediaProbeError(RuntimeError):
    pass


@dataclass(frozen=True)
class MediaProbeResult:
    container: str
    duration_ms: int
    size_bytes: int
    video_codec: str
    audio_codec: str
    width: int
    height: int


def detect_container_signature(path: Path) -> str:
    with path.open('rb') as source:
        header = source.read(16)
    if len(header) >= 12 and header[4:8] == b'ftyp':
        return 'mp4'
    if header.startswith(b'\x1a\x45\xdf\xa3'):
        return 'matroska'
    raise MediaProbeError('UNSUPPORTED_FILE_SIGNATURE')


def probe_media_file(path: Path) -> MediaProbeResult:
    binary = shutil.which('ffprobe')
    if not binary:
        raise MediaProbeError('FFPROBE_NOT_AVAILABLE')
    command = [
        binary,
        '-v', 'error',
        '-probesize', '50000000',
        '-analyzeduration', '30000000',
        '-show_entries',
        'format=format_name,duration,size:stream=codec_type,codec_name,width,height',
        '-of', 'json',
        str(path),
    ]
    try:
        process = subprocess.run(
            command,
            capture_output=True,
            check=False,
            timeout=settings.MEDIA_INSPECTION_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise MediaProbeError('FFPROBE_TIMEOUT') from exc
    if process.returncode != 0:
        raise MediaProbeError('FFPROBE_REJECTED_FILE')
    if len(process.stdout) > 1_000_000:
        raise MediaProbeError('FFPROBE_OUTPUT_TOO_LARGE')
    try:
        payload = json.loads(process.stdout)
        media_format = payload.get('format') or {}
        streams = payload.get('streams') or []
        video = next(stream for stream in streams if stream.get('codec_type') == 'video')
        audio = next((stream for stream in streams if stream.get('codec_type') == 'audio'), None)
        duration = float(media_format['duration'])
        result = MediaProbeResult(
            container=str(media_format.get('format_name') or '').split(',')[0],
            duration_ms=round(duration * 1000),
            size_bytes=int(media_format['size']),
            video_codec=str(video.get('codec_name') or ''),
            audio_codec=str(audio.get('codec_name') or '') if audio else '',
            width=int(video.get('width') or 0),
            height=int(video.get('height') or 0),
        )
    except (KeyError, StopIteration, TypeError, ValueError) as exc:
        raise MediaProbeError('INVALID_MEDIA_METADATA') from exc
    if not math.isfinite(duration) or result.duration_ms <= 0:
        raise MediaProbeError('INVALID_MEDIA_DURATION')
    return result
