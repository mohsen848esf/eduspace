"""
Smoke test for the watch-tracking endpoints.

Walks through:
  * publish a completed recording to a viewer
  * viewer fires a heartbeat
  * host calls /views/ and sees the viewer's progress
  * viewer fires a second heartbeat further along
  * /views/ reflects the new furthest_position
  * a non-owner stranger gets 403 on /views/
"""

from __future__ import annotations

import json
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
for name in ("rooms", "rooms.recording", "rooms.recording.views"):
    logging.getLogger(name).setLevel(logging.WARNING)

from accounts.models import User  # noqa: E402
from rooms.models import Recording, RecordingView  # noqa: E402


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
    if not rec.duration_seconds:
        print(f"FAIL: recording {rec.public_token} has duration=0; finalize first")
        return 1

    owner = rec.owner
    viewer = (
        User.objects
        .filter(is_superuser=False)
        .exclude(pk=owner.pk)
        .first()
    )
    stranger = User.objects.filter(is_superuser=False).exclude(pk__in=[owner.pk, viewer.pk]).first()
    if viewer is None or stranger is None:
        print("FAIL: need at least 3 non-superuser users (owner + viewer + stranger)")
        return 1

    print(f"using rec={rec.public_token} duration={rec.duration_seconds}s "
          f"owner={owner.username} viewer={viewer.username} stranger={stranger.username}")

    # Reset prior view rows for this rec/user so the test is repeatable.
    RecordingView.objects.filter(recording=rec).delete()

    c = Client()

    # Publish to viewer.
    resp = c.post(
        f"/api/recordings/{rec.public_token}/publish/",
        data=json.dumps({"user_ids": [viewer.pk]}),
        content_type="application/json",
        **bearer(owner),
    )
    assert resp.status_code == 200, f"publish -> {resp.status_code} {resp.content!r}"

    # First heartbeat at t=2s.
    resp = c.post(
        f"/api/recordings/{rec.public_token}/heartbeat/",
        data=json.dumps({"position_seconds": 2}),
        content_type="application/json",
        **bearer(viewer),
    )
    assert resp.status_code == 200, f"heartbeat 1 -> {resp.status_code} {resp.content!r}"
    body = resp.json()
    assert body["last_position_seconds"] == 2.0
    assert body["furthest_position_seconds"] == 2.0
    assert body["view_count"] == 1
    print("OK   first heartbeat recorded")

    # Host views.
    resp = c.get(
        f"/api/recordings/{rec.public_token}/views/",
        **bearer(owner),
    )
    assert resp.status_code == 200, f"views 1 -> {resp.status_code} {resp.content!r}"
    body = resp.json()
    assert body["count"] == 1
    item = body["results"][0]
    assert item["username"] == viewer.username
    assert abs(item["furthest_position_seconds"] - 2.0) < 0.001
    assert 0 < item["completion_ratio"] <= 1
    print(f"OK   host sees 1 viewer at completion={item['completion_ratio']:.2f}")

    # Second heartbeat further along.
    further = max(2.0, float(rec.duration_seconds) - 0.5)
    resp = c.post(
        f"/api/recordings/{rec.public_token}/heartbeat/",
        data=json.dumps({"position_seconds": further}),
        content_type="application/json",
        **bearer(viewer),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["furthest_position_seconds"] == min(further, float(rec.duration_seconds))
    print(f"OK   furthest position advanced to {body['furthest_position_seconds']:.2f}")

    # Heartbeat backwards: last_position changes but furthest doesn't.
    resp = c.post(
        f"/api/recordings/{rec.public_token}/heartbeat/",
        data=json.dumps({"position_seconds": 1}),
        content_type="application/json",
        **bearer(viewer),
    )
    body = resp.json()
    assert body["last_position_seconds"] == 1.0
    assert body["furthest_position_seconds"] >= further - 0.5
    print("OK   rewind keeps furthest_position intact")

    # Owner heartbeat is ignored.
    resp = c.post(
        f"/api/recordings/{rec.public_token}/heartbeat/",
        data=json.dumps({"position_seconds": 5}),
        content_type="application/json",
        **bearer(owner),
    )
    assert resp.status_code == 200
    assert resp.json().get("ignored") == "owner"
    print("OK   owner heartbeat ignored")

    # Stranger 403 on /views/.
    resp = c.get(
        f"/api/recordings/{rec.public_token}/views/",
        **bearer(stranger),
    )
    assert resp.status_code == 403, f"stranger views -> {resp.status_code}"
    print("OK   stranger blocked from /views/")

    # Stranger 403 on /heartbeat/ for an unpublished-to recording.
    resp = c.post(
        f"/api/recordings/{rec.public_token}/heartbeat/",
        data=json.dumps({"position_seconds": 3}),
        content_type="application/json",
        **bearer(stranger),
    )
    assert resp.status_code == 403, f"stranger heartbeat -> {resp.status_code}"
    print("OK   stranger blocked from /heartbeat/")

    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
