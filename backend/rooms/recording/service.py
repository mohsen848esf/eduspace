"""
Sync facade around the async livekit.api.LiveKitAPI for egress control.

The Django views are sync, the LiveKit SDK is async. We bridge with
asyncio.run for a fresh client per call (safer than caching a global
client across threads) and surface a small typed surface area that's
easy to mock in tests.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from django.conf import settings
from livekit import api as lk

logger = logging.getLogger(__name__)


QUALITY_PRESETS = {
    '720p': lk.EncodedFileOutput,  # placeholder; preset chosen below
}


@dataclass(frozen=True)
class EgressLaunch:
    """Result of a successful StartRoomCompositeEgress call."""
    egress_id: str
    file_path_relative: str  # relative to MEDIA_ROOT


def _preset_for(quality: str) -> lk.EncodingOptionsPreset:
    if quality == '1080p':
        return lk.EncodingOptionsPreset.H264_1080P_30
    return lk.EncodingOptionsPreset.H264_720P_30


def _segment_filename(recording_token: str, index: int) -> str:
    """
    Path the egress worker writes to, expressed relative to the
    container's /out mount (== backend/media/recordings on the host).
    """
    return f'{recording_token}/seg-{index:03d}.mp4'


def _ensure_segment_dir(recording_token: str) -> None:
    target = Path(settings.RECORDING_OUTPUT_DIR) / recording_token
    target.mkdir(parents=True, exist_ok=True)


def start_room_composite(
    *,
    room_code: str,
    recording_token: str,
    segment_index: int,
    quality: str,
) -> EgressLaunch:
    """
    Kick off a RoomCompositeEgress that writes a single MP4 file.
    Returns the egress id and the file path (relative to MEDIA_ROOT)
    so the caller can persist them.
    """
    _ensure_segment_dir(recording_token)

    relative = _segment_filename(recording_token, segment_index)
    # Inside the egress container the bind mount is /out, so the
    # absolute filepath we hand LiveKit must use that prefix.
    egress_filepath = f'/out/{relative}'

    file_output = lk.EncodedFileOutput(
        file_type=lk.EncodedFileType.MP4,
        filepath=egress_filepath,
    )

    request = lk.RoomCompositeEgressRequest(
        room_name=room_code,
        layout='grid',
        audio_only=False,
        video_only=False,
        file_outputs=[file_output],
        preset=_preset_for(quality),
    )

    async def _run() -> str:
        client = lk.LiveKitAPI(
            url=settings.LIVEKIT_HOST_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )
        try:
            info = await client.egress.start_room_composite_egress(request)
            return info.egress_id
        finally:
            await client.aclose()

    egress_id = asyncio.run(_run())
    logger.info(
        'egress.start room=%s token=%s seg=%d quality=%s -> %s',
        room_code, recording_token, segment_index, quality, egress_id,
    )
    return EgressLaunch(egress_id=egress_id, file_path_relative=relative)


def stop_egress(egress_id: str) -> None:
    """
    Stop an in-flight egress run. Idempotent from the caller's
    perspective: errors are logged but don't bubble up because the
    egress may already have finished naturally.
    """
    async def _run() -> None:
        client = lk.LiveKitAPI(
            url=settings.LIVEKIT_HOST_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )
        try:
            await client.egress.stop_egress(
                lk.StopEgressRequest(egress_id=egress_id),
            )
        finally:
            await client.aclose()

    try:
        asyncio.run(_run())
        logger.info('egress.stop %s', egress_id)
    except Exception:
        # Don't fail the user-facing request if the worker already finished.
        logger.exception('egress.stop %s failed', egress_id)


def absolute_segment_path(file_path_relative: str) -> Optional[Path]:
    """
    Resolve a relative segment path (as stored on RecordingSegment) to
    the absolute path on disk, or None if the file is missing.
    """
    abs_path = Path(settings.RECORDING_OUTPUT_DIR) / file_path_relative
    return abs_path if abs_path.exists() else None


def file_size_bytes(file_path_relative: str) -> int:
    abs_path = Path(settings.RECORDING_OUTPUT_DIR) / file_path_relative
    try:
        return os.path.getsize(abs_path)
    except OSError:
        return 0
