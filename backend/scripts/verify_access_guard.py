"""
Confirms the backend behavior the frontend access guard depends on:
publish -> viewer 200, unpublish -> viewer 403 on detail and stream.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import django

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.test import Client  # noqa: E402
from rest_framework_simplejwt.tokens import RefreshToken  # noqa: E402

logging.getLogger("django.request").setLevel(logging.ERROR + 1)

from accounts.models import User  # noqa: E402
from rooms.models import Recording  # noqa: E402


def bearer(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {RefreshToken.for_user(user).access_token}"}


def main() -> int:
    rec = (
        Recording.objects
        .filter(is_deleted=False, status=Recording.Status.COMPLETED)
        .order_by("-started_at")
        .first()
    )
    if rec is None:
        print("FAIL: no completed recording")
        return 1
    owner = rec.owner
    other = User.objects.filter(is_superuser=False).exclude(pk=owner.pk).first()
    if other is None:
        print("FAIL: need a non-superuser non-owner")
        return 1

    print(f"recording {rec.public_token}; owner={owner.username}; viewer={other.username}")

    client = Client()

    # Publish to the viewer.
    resp = client.post(
        f"/api/recordings/{rec.public_token}/publish/",
        data={"user_ids": [other.pk]},
        content_type="application/json",
        **bearer(owner),
    )
    assert resp.status_code == 200, resp.content

    # Viewer can see detail.
    resp = client.get(f"/api/recordings/{rec.public_token}/", **bearer(other))
    assert resp.status_code == 200, f"detail after publish -> {resp.status_code} {resp.content!r}"
    print("OK   viewer detail 200 after publish")

    # Unpublish.
    resp = client.post(
        f"/api/recordings/{rec.public_token}/unpublish/",
        data={},
        content_type="application/json",
        **bearer(owner),
    )
    assert resp.status_code == 200

    # Viewer's detail should now 403.
    resp = client.get(f"/api/recordings/{rec.public_token}/", **bearer(other))
    if resp.status_code != 403:
        print(f"FAIL: detail after unpublish -> {resp.status_code} {resp.content!r}")
        return 1
    print("OK   viewer detail 403 after unpublish")

    # Stream too.
    resp = client.get(f"/api/recordings/{rec.public_token}/stream/", **bearer(other))
    if resp.status_code != 403:
        print(f"FAIL: stream after unpublish -> {resp.status_code}")
        return 1
    print("OK   viewer stream 403 after unpublish")

    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
