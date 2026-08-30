from django.conf import settings
from django.core import signing


GUEST_ACCESS_TOKEN_SALT = 'rooms.guest-access.v1'
DEFAULT_GUEST_ACCESS_MAX_AGE_SECONDS = 6 * 60 * 60


class InvalidGuestAccessToken(Exception):
    """Raised when a guest credential is missing, expired, or out of scope."""


def issue_guest_access_token(*, room_code: str, guest_identity: str) -> str:
    return signing.dumps(
        {
            'room_code': room_code,
            'guest_identity': guest_identity,
        },
        salt=GUEST_ACCESS_TOKEN_SALT,
        compress=True,
    )


def decode_guest_access_token(*, token: str, room_code: str) -> str:
    max_age = getattr(
        settings,
        'GUEST_ACCESS_TOKEN_MAX_AGE_SECONDS',
        DEFAULT_GUEST_ACCESS_MAX_AGE_SECONDS,
    )
    try:
        payload = signing.loads(
            token,
            salt=GUEST_ACCESS_TOKEN_SALT,
            max_age=max_age,
        )
    except (signing.BadSignature, signing.SignatureExpired, TypeError, ValueError) as exc:
        raise InvalidGuestAccessToken from exc

    if not isinstance(payload, dict) or payload.get('room_code') != room_code:
        raise InvalidGuestAccessToken

    guest_identity = payload.get('guest_identity')
    if not isinstance(guest_identity, str) or not guest_identity.startswith('guest_'):
        raise InvalidGuestAccessToken

    return guest_identity
