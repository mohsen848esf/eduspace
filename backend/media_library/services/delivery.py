import re

from django.conf import settings
from django.core import signing

from media_library.models import MediaAsset, SharedPlaybackSession


PLAYBACK_TICKET_SALT = 'media-library.playback-ticket.v1'
SEGMENT_NAME = re.compile(r'^(?:init\.mp4|segment_\d{6}\.m4s)$')


class MediaDeliveryError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class MediaDeliveryService:
    @staticmethod
    def issue_ticket(playback: SharedPlaybackSession) -> str:
        return signing.dumps({
            'playback_id': playback.pk,
            'room_code': playback.room.room_code,
            'asset_token': playback.asset.public_token,
        }, salt=PLAYBACK_TICKET_SALT, compress=True)

    @staticmethod
    def resolve_ticket(ticket: str) -> SharedPlaybackSession:
        try:
            payload = signing.loads(
                ticket,
                salt=PLAYBACK_TICKET_SALT,
                max_age=settings.MEDIA_PLAYBACK_TICKET_TTL_SECONDS,
            )
        except (signing.BadSignature, signing.SignatureExpired, TypeError, ValueError) as exc:
            raise MediaDeliveryError('INVALID_PLAYBACK_TICKET') from exc
        if not isinstance(payload, dict):
            raise MediaDeliveryError('INVALID_PLAYBACK_TICKET')
        playback = SharedPlaybackSession.objects.select_related('room', 'asset').filter(
            pk=payload.get('playback_id'),
            room__room_code=payload.get('room_code'),
            asset__public_token=payload.get('asset_token'),
            ended_at__isnull=True,
            asset__is_deleted=False,
            asset__status__in=[MediaAsset.Status.READY, MediaAsset.Status.PARTIALLY_PLAYABLE],
        ).first()
        if playback is None:
            raise MediaDeliveryError('PLAYBACK_DELIVERY_NOT_AVAILABLE')
        return playback

    @staticmethod
    def rewrite_variant_playlist(*, playlist: str, segment_url) -> str:
        output = []
        for line in playlist.splitlines():
            if line.startswith('#EXT-X-MAP:'):
                match = re.search(r'URI="([^"]+)"', line)
                if not match or not SEGMENT_NAME.fullmatch(match.group(1)):
                    raise MediaDeliveryError('INVALID_HLS_MANIFEST')
                line = line[:match.start(1)] + segment_url(match.group(1)) + line[match.end(1):]
            elif line and not line.startswith('#'):
                if not SEGMENT_NAME.fullmatch(line):
                    raise MediaDeliveryError('INVALID_HLS_MANIFEST')
                line = segment_url(line)
            output.append(line)
        return '\n'.join(output) + '\n'

    @staticmethod
    def require_segment_name(filename: str) -> None:
        if not SEGMENT_NAME.fullmatch(filename):
            raise MediaDeliveryError('INVALID_HLS_SEGMENT')
