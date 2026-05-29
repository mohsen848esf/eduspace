"""
HTTP Range support for recording playback.

HTML5 <video> seeks via Range requests; without proper Range handling
the browser can only play the file linearly from byte 0. This module
parses a Range header and produces a streaming response that respects
it, with the right status code (206 Partial Content) and Content-Range
header.

The implementation is deliberately tiny: streaming MP4s through Django
is fine for dev and early prod (a single uvicorn worker can handle
hundreds of concurrent seeks). When we move to S3 we'll hand off to a
signed-URL CDN; the API surface here is independent of that change.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterator, Optional, Tuple

from django.http import FileResponse, HttpResponse, HttpResponseNotModified
from django.utils.http import http_date


_RANGE_RE = re.compile(r'bytes=(?P<start>\d*)-(?P<end>\d*)$')

# Send 1 MB at a time so a single seek doesn't hold the worker for long.
DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024


def _parse_range_header(value: str, file_size: int) -> Optional[Tuple[int, int]]:
    """
    Parse a single-range HTTP Range header (we don't support multipart
    ranges since browsers don't request them for media). Returns a
    closed-closed [start, end] byte range or None on parse failure.
    """
    if not value:
        return None
    match = _RANGE_RE.match(value.strip())
    if not match:
        return None

    raw_start = match.group('start')
    raw_end = match.group('end')

    if raw_start == '' and raw_end == '':
        return None
    if raw_start == '':
        # Suffix range: "bytes=-N" => last N bytes.
        try:
            length = int(raw_end)
        except ValueError:
            return None
        if length <= 0:
            return None
        start = max(0, file_size - length)
        end = file_size - 1
        return start, end

    try:
        start = int(raw_start)
    except ValueError:
        return None
    if raw_end == '':
        end = file_size - 1
    else:
        try:
            end = int(raw_end)
        except ValueError:
            return None
        end = min(end, file_size - 1)

    if start < 0 or start >= file_size or start > end:
        return None
    return start, end


def _iter_file_range(
    path: Path, start: int, end: int, chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> Iterator[bytes]:
    remaining = end - start + 1
    with open(path, 'rb') as fh:
        fh.seek(start)
        while remaining > 0:
            buf = fh.read(min(chunk_size, remaining))
            if not buf:
                break
            remaining -= len(buf)
            yield buf


def serve_video_with_range(
    path: Path,
    *,
    range_header: str,
    if_modified_since: Optional[str] = None,
    content_type: str = 'video/mp4',
    filename: Optional[str] = None,
) -> HttpResponse:
    """
    Build the right response for a media playback GET. Supports:
      * full GET (200 OK)
      * single-range GET (206 Partial Content)
      * cache validation via Last-Modified / If-Modified-Since (304)
    """
    stat = path.stat()
    file_size = stat.st_size
    last_modified = stat.st_mtime

    # Conditional GET
    if if_modified_since:
        try:
            from email.utils import parsedate_to_datetime
            ims = parsedate_to_datetime(if_modified_since).timestamp()
        except (TypeError, ValueError):
            ims = None
        if ims and int(ims) >= int(last_modified):
            return HttpResponseNotModified()

    parsed = _parse_range_header(range_header, file_size) if range_header else None

    if parsed is None:
        # Full file response (HTML5 <video> uses this when seeking is disabled
        # or for the initial probe before issuing a Range request).
        response = FileResponse(open(path, 'rb'), content_type=content_type)
        response['Content-Length'] = str(file_size)
        response['Accept-Ranges'] = 'bytes'
    else:
        start, end = parsed
        response = HttpResponse(
            _iter_file_range(path, start, end),
            status=206,
            content_type=content_type,
        )
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(end - start + 1)
        response['Accept-Ranges'] = 'bytes'

    response['Last-Modified'] = http_date(last_modified)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    if filename:
        # inline so the browser plays it instead of triggering a download.
        response['Content-Disposition'] = f'inline; filename="{filename}"'

    return response
