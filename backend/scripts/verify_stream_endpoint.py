"""
Self-contained smoke test for the recording library endpoints.

Logs in as the recording owner, calls list/detail/stream, and verifies
each behaves correctly. Intended to be runnable on a working dev stack
without manual JWT copying.

Usage:
    backend\\venv\\Scripts\\python.exe backend\\scripts\\verify_stream_endpoint.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import django

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

# Silence Django's automatic logging of 4xx responses — we _expect_ 403s
# in the cross-user permission test below.
import logging  # noqa: E402
logging.getLogger('django.request').setLevel(logging.ERROR + 1)

from accounts.models import User  # noqa: E402
from rooms.models import Recording  # noqa: E402


def _bearer(user: User) -> dict:
    token = RefreshToken.for_user(user).access_token
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


def main() -> int:
    rec = Recording.objects.filter(
        is_deleted=False,
        status=Recording.Status.COMPLETED,
    ).order_by('-started_at').first()
    if rec is None:
        print('FAIL: no completed recording found in the database')
        return 1
    owner = rec.owner
    print(f'using recording token={rec.public_token} owner={owner.username}')

    other = (
        User.objects
        .filter(is_superuser=False)
        .exclude(pk=owner.pk)
        .first()
    )
    if other is None:
        print('WARN: no non-superuser second user available; skipping cross-user permission test')

    client = Client()

    # 1. List as owner — recording should be present.
    resp = client.get('/api/recordings/', **_bearer(owner))
    assert resp.status_code == 200, f'list -> {resp.status_code} {resp.content!r}'
    tokens = {item['public_token'] for item in resp.json()['results']}
    assert rec.public_token in tokens, 'recording missing from owner library'
    print('OK   list as owner')

    # 2. Detail as owner.
    resp = client.get(f'/api/recordings/{rec.public_token}/', **_bearer(owner))
    assert resp.status_code == 200
    body = resp.json()
    assert body['public_token'] == rec.public_token
    assert body['is_owner'] is True
    print('OK   detail as owner')

    # 3. Stream as owner — full GET, expect 200 + Content-Length.
    resp = client.get(f'/api/recordings/{rec.public_token}/stream/', **_bearer(owner))
    assert resp.status_code == 200, f'stream full -> {resp.status_code}'
    assert resp.get('Accept-Ranges') == 'bytes'
    print(f'OK   stream full (bytes={resp.get("Content-Length")})')

    # 4. Range request — expect 206.
    resp = client.get(
        f'/api/recordings/{rec.public_token}/stream/',
        HTTP_RANGE='bytes=0-1023',
        **_bearer(owner),
    )
    assert resp.status_code == 206, f'stream range -> {resp.status_code}'
    cr = resp.get('Content-Range')
    assert cr and cr.startswith('bytes 0-1023/'), cr
    print(f'OK   stream range ({cr})')

    # 5. Cross-user permission: a non-owner who isn't in visible_to should get 403.
    if other is not None and not rec.is_published:
        resp = client.get(f'/api/recordings/{rec.public_token}/', **_bearer(other))
        assert resp.status_code == 403, f'cross-user detail -> {resp.status_code}'
        resp = client.get(
            f'/api/recordings/{rec.public_token}/stream/',
            **_bearer(other),
        )
        assert resp.status_code == 403, f'cross-user stream -> {resp.status_code}'
        print('OK   cross-user blocked (403)')

    print('all checks passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
