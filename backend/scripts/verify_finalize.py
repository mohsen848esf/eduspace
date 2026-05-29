"""
Programmatic E2E for the finalize / publish / unpublish endpoints.

Picks the most recent completed recording in the database, runs:
  * finalize without trim
  * finalize with trim
  * publish to a non-owner non-superuser
  * stream as the new viewer (should pass)
  * unpublish
  * stream again as the viewer (should now 403)

Skips cleanly if no completed recording exists on the dev DB.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import django

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings  # noqa: E402
from django.test import Client  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

# Silence Django's automatic 4xx logging.
logging.getLogger('django.request').setLevel(logging.ERROR + 1)
# And our own info logs (we want clean stdout when this script is used in CI).
for name in ('rooms', 'rooms.recording', 'rooms.recording.views', 'rooms.recording.webhook'):
    logging.getLogger(name).setLevel(logging.WARNING)

from accounts.models import User  # noqa: E402
from rooms.models import Recording  # noqa: E402


def _bearer(user: User) -> dict:
    token = RefreshToken.for_user(user).access_token
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


def main() -> int:
    rec = (
        Recording.objects
        .filter(is_deleted=False, status=Recording.Status.COMPLETED)
        .order_by('-started_at')
        .first()
    )
    if rec is None:
        print('FAIL: no completed recording in DB; run a real recording first')
        return 1

    owner = rec.owner
    other = (
        User.objects
        .filter(is_superuser=False)
        .exclude(pk=owner.pk)
        .first()
    )
    if other is None:
        print('FAIL: need at least one non-superuser, non-owner user')
        return 1

    print(f'using recording token={rec.public_token} owner={owner.username} viewer={other.username}')

    client = Client()

    # 1. Finalize with no trim — produces final.mp4.
    resp = client.post(
        f'/api/recordings/{rec.public_token}/finalize/',
        data={},
        content_type='application/json',
        **_bearer(owner),
    )
    assert resp.status_code == 200, f'finalize -> {resp.status_code} {resp.content!r}'
    body = resp.json()
    assert body['public_token'] == rec.public_token
    expected_path = f'{rec.public_token}/final.mp4'
    abs_final = settings.RECORDING_OUTPUT_DIR / expected_path
    assert abs_final.exists(), f'final.mp4 missing at {abs_final}'
    print(f'OK   finalize without trim ({abs_final.stat().st_size} bytes)')

    # 2. Finalize with trim that's a clear no-op-ish (start=0, end=duration).
    rec.refresh_from_db()
    full_dur = rec.duration_seconds
    if full_dur < 2:
        print(f'WARN: recording duration is {full_dur}s; trim test will be a no-op')
        trim_end = full_dur
    else:
        trim_end = full_dur - 1
    resp = client.post(
        f'/api/recordings/{rec.public_token}/finalize/',
        data={'trim_start_seconds': 0, 'trim_end_seconds': trim_end},
        content_type='application/json',
        **_bearer(owner),
    )
    assert resp.status_code == 200, f'finalize+trim -> {resp.status_code} {resp.content!r}'
    rec.refresh_from_db()
    print(f'OK   finalize with trim (duration={rec.duration_seconds}s, trim_end={rec.trim_end_seconds})')

    # 3. Viewer can't see it pre-publish (owner only).
    resp = client.get(f'/api/recordings/{rec.public_token}/', **_bearer(other))
    assert resp.status_code == 403, f'pre-publish detail -> {resp.status_code}'
    resp = client.get(f'/api/recordings/{rec.public_token}/stream/', **_bearer(other))
    assert resp.status_code == 403, f'pre-publish stream -> {resp.status_code}'
    print('OK   viewer blocked before publish')

    # 4. Publish to the viewer.
    resp = client.post(
        f'/api/recordings/{rec.public_token}/publish/',
        data={'user_ids': [other.pk]},
        content_type='application/json',
        **_bearer(owner),
    )
    assert resp.status_code == 200, f'publish -> {resp.status_code} {resp.content!r}'
    body = resp.json()
    assert body['is_published'] is True
    assert any(s['id'] == other.pk for s in body['shared_with'])
    print('OK   publish')

    # 5. Viewer can now see it.
    resp = client.get(f'/api/recordings/{rec.public_token}/', **_bearer(other))
    assert resp.status_code == 200, f'post-publish detail -> {resp.status_code}'
    body = resp.json()
    assert body['is_owner'] is False
    resp = client.get(f'/api/recordings/{rec.public_token}/stream/', **_bearer(other))
    assert resp.status_code == 200
    assert resp.get('Accept-Ranges') == 'bytes'
    print('OK   viewer can stream after publish')

    # 6. Unpublish.
    resp = client.post(
        f'/api/recordings/{rec.public_token}/unpublish/',
        data={},
        content_type='application/json',
        **_bearer(owner),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body['is_published'] is False
    print('OK   unpublish')

    # 7. Viewer is locked out again.
    resp = client.get(f'/api/recordings/{rec.public_token}/', **_bearer(other))
    assert resp.status_code == 403, f'post-unpublish detail -> {resp.status_code}'
    resp = client.get(f'/api/recordings/{rec.public_token}/stream/', **_bearer(other))
    assert resp.status_code == 403
    print('OK   viewer blocked after unpublish')

    # 8. Non-owner can't finalize / publish / unpublish.
    for action in ('finalize', 'publish', 'unpublish'):
        resp = client.post(
            f'/api/recordings/{rec.public_token}/{action}/',
            data={},
            content_type='application/json',
            **_bearer(other),
        )
        assert resp.status_code == 403, f'non-owner {action} -> {resp.status_code}'
    print('OK   non-owner cannot finalize/publish/unpublish')

    print('all checks passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
