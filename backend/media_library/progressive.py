from dataclasses import dataclass


@dataclass(frozen=True)
class Mp4Compatibility:
    eligible: bool
    code: str


def _boxes(payload: bytes):
    """Yield complete ISO-BMFF boxes; malformed/truncated input fails closed."""
    offset = 0
    while offset + 8 <= len(payload):
        size = int.from_bytes(payload[offset:offset + 4], 'big')
        kind = payload[offset + 4:offset + 8]
        header = 8
        if size == 1:
            if offset + 16 > len(payload):
                return
            size = int.from_bytes(payload[offset + 8:offset + 16], 'big')
            header = 16
        elif size == 0:
            size = len(payload) - offset
        if size < header or size > 2**63 - 1 or offset + size > len(payload):
            return
        yield kind, payload[offset + header:offset + size]
        offset += size


def classify_mp4_prefix(payload: bytes) -> Mp4Compatibility:
    """Classify only from server-read bytes; never from a client MIME hint."""
    if len(payload) < 8:
        return Mp4Compatibility(False, 'MP4_PREFIX_INCOMPLETE')
    seen_ftyp = False
    offset = 0
    while offset + 8 <= len(payload):
        size = int.from_bytes(payload[offset:offset + 4], 'big')
        kind = payload[offset + 4:offset + 8]
        header = 8
        if size == 1:
            if offset + 16 > len(payload):
                return Mp4Compatibility(False, 'MP4_PREFIX_INCOMPLETE')
            size = int.from_bytes(payload[offset + 8:offset + 16], 'big')
            header = 16
        elif size == 0:
            size = len(payload) - offset
        if size < header or size > 2**63 - 1:
            return Mp4Compatibility(False, 'INVALID_MP4_PREFIX')
        if kind == b'ftyp':
            seen_ftyp = True
        elif kind == b'moof' and seen_ftyp:
            return Mp4Compatibility(True, 'FRAGMENTED_MP4')
        elif kind == b'moov' and seen_ftyp:
            if offset + size > len(payload):
                return Mp4Compatibility(False, 'MP4_PREFIX_INCOMPLETE')
            body = payload[offset + header:offset + size]
            if any(child_kind == b'mvex' for child_kind, _ in _boxes(body)):
                return Mp4Compatibility(True, 'FRAGMENTED_MP4')
            return Mp4Compatibility(True, 'FASTSTART_MP4')
        elif kind == b'mdat' and seen_ftyp:
            return Mp4Compatibility(False, 'MP4_MOOV_AFTER_MDAT')
        if offset + size > len(payload):
            return Mp4Compatibility(False, 'MP4_PREFIX_INCOMPLETE')
        offset += size
    return Mp4Compatibility(False, 'MP4_PREFIX_INCOMPLETE' if seen_ftyp else 'INVALID_MP4_PREFIX')
