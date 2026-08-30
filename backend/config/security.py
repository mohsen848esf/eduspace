from django.core.exceptions import ImproperlyConfigured


MIN_SIGNING_SECRET_BYTES = 32


def validate_signing_secret(
    value: str,
    *,
    setting_name: str,
    forbidden_values: tuple[str, ...] = (),
) -> str:
    """Reject signing secrets that are too short for HS256."""
    byte_length = len(value.encode('utf-8'))
    if byte_length < MIN_SIGNING_SECRET_BYTES:
        raise ImproperlyConfigured(
            f'{setting_name} must be at least {MIN_SIGNING_SECRET_BYTES} bytes; '
            f'got {byte_length}.'
        )
    if value in forbidden_values:
        raise ImproperlyConfigured(
            f'{setting_name} must not use the local development default outside DEBUG mode.'
        )
    return value
