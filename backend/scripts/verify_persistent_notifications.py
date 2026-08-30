"""
Smoke test for persistent notifications (offline inbox).

Covers:
  - record_and_dispatch persists a Notification row.
  - List endpoint returns the row, ordered most-recent-first.
  - unread_only filter works.
  - Mark-read / mark-all-read flip read_at.
  - Delete removes the row.

Usage:
    backend\\venv\\Scripts\\python.exe backend\\scripts\\verify_persistent_notifications.py
"""

from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, "backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from accounts.models import Notification, User  # noqa: E402
from accounts.notifications import record_and_dispatch  # noqa: E402


def main() -> int:
    user = User.objects.filter(is_superuser=False).first()
    if not user:
        print("FAIL: need at least one non-superuser user")
        return 1

    # Clean slate for this user.
    Notification.objects.filter(user=user).delete()

    client = APIClient()
    client.force_authenticate(user=user)

    # 1. record_and_dispatch persists the row.
    n1 = record_and_dispatch(
        user.id,
        Notification.Kind.ROOM_INVITE,
        {
            "type": "ROOM_INVITE",
            "room_code": "ABC123",
            "room_name": "Smoke test room",
            "from": "tester",
            "invite_link": "/room/ABC123",
        },
    )
    assert n1 is not None, "record_and_dispatch returned None"
    assert n1.pk is not None
    assert n1.kind == "ROOM_INVITE"
    print("OK   record_and_dispatch persisted row")

    # Slight pause so created_at differs.
    time.sleep(0.01)

    n2 = record_and_dispatch(
        user.id,
        Notification.Kind.RECORDING_PUBLISHED,
        {
            "type": "RECORDING_PUBLISHED",
            "recording_token": "tok",
            "room_code": "ABC123",
            "room_name": "Smoke test room",
            "from": "tester",
            "duration_seconds": 42,
            "watch_link": "/recordings/tok",
        },
    )
    assert n2 is not None
    print("OK   second notification persisted")

    # 2. List endpoint, ordered most-recent-first.
    r = client.get("/api/auth/notifications/")
    assert r.status_code == 200, r.status_code
    assert r.data["count"] == 2, r.data
    assert r.data["unread_count"] == 2, r.data
    assert r.data["results"][0]["id"] == n2.id, r.data["results"]
    assert r.data["results"][1]["id"] == n1.id, r.data["results"]
    print("OK   list endpoint returns rows in reverse order")

    # 3. unread_only filter.
    r = client.get("/api/auth/notifications/?unread_only=true")
    assert r.status_code == 200
    assert r.data["count"] == 2
    print("OK   unread_only=true returns both unread rows")

    # 4. Mark-read on a single row.
    r = client.post(f"/api/auth/notifications/{n1.id}/read/")
    assert r.status_code == 200
    assert r.data["read_at"] is not None
    n1.refresh_from_db()
    assert n1.read_at is not None
    print("OK   single mark-read flipped read_at")

    r = client.get("/api/auth/notifications/?unread_only=true")
    assert r.data["count"] == 1
    assert r.data["results"][0]["id"] == n2.id
    print("OK   mark-read removed row from unread_only listing")

    # 5. Mark-all-read.
    r = client.post("/api/auth/notifications/read-all/")
    assert r.status_code == 200
    n2.refresh_from_db()
    assert n2.read_at is not None
    r = client.get("/api/auth/notifications/?unread_only=true")
    assert r.data["count"] == 0
    print("OK   mark-all-read clears unread")

    # 6. Delete one.
    r = client.delete(f"/api/auth/notifications/{n1.id}/")
    assert r.status_code == 204
    assert not Notification.objects.filter(pk=n1.id).exists()
    print("OK   delete removed the row")

    # 7. Foreign user can't read another user's notifications.
    other = User.objects.exclude(pk=user.pk).filter(is_superuser=False).first()
    if other:
        other_client = APIClient()
        other_client.force_authenticate(user=other)
        r = other_client.post(f"/api/auth/notifications/{n2.id}/read/")
        assert r.status_code == 404, r.status_code
        print("OK   other user can't mark someone else's notification read")
    else:
        print("SKIP cross-user check (no second non-superuser user)")

    # Cleanup the rest.
    Notification.objects.filter(user=user).delete()

    print("\nall checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
