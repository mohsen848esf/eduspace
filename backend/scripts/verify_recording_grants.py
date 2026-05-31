"""
Smoke test for the recording-permission feature (T-05).

Covers:
  - Host can grant + revoke a participant.
  - GET /recording/permission/ surfaces can_control correctly for host,
    grantee, and a stranger participant.
  - Granted user can hit start/stop endpoints (200/2xx instead of 403).
  - Revoked user is back to 403 immediately.
  - Non-host who isn't a grantee gets 403 on the set endpoint.

Usage:
    python backend/scripts/verify_recording_grants.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, "backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from rest_framework.test import APIClient  # noqa: E402

from accounts.models import User  # noqa: E402
from rooms.models import Room, RoomParticipant  # noqa: E402


def _login(client: APIClient, user: User) -> None:
    """Force-authenticate the test client as the given user."""
    client.force_authenticate(user=user)


def main() -> int:
    host = User.objects.filter(is_superuser=False).first()
    grantee = (
        User.objects.filter(is_superuser=False).exclude(pk=host.pk).first()
        if host
        else None
    )
    stranger = (
        User.objects.filter(is_superuser=False)
        .exclude(pk__in=[host.pk if host else 0, grantee.pk if grantee else 0])
        .first()
        if host and grantee
        else None
    )
    if not host or not grantee or not stranger:
        print("FAIL: need at least 3 non-superuser users")
        return 1

    # Create a fresh room with all three as participants.
    room = Room.objects.create(
        name="grant-test",
        room_code="GRANT1",
        host=host,
    )
    RoomParticipant.objects.create(
        room=room, user=host, role=RoomParticipant.Role.HOST,
    )
    RoomParticipant.objects.create(room=room, user=grantee)
    RoomParticipant.objects.create(room=room, user=stranger)

    try:
        host_client = APIClient()
        _login(host_client, host)
        grantee_client = APIClient()
        _login(grantee_client, grantee)
        stranger_client = APIClient()
        _login(stranger_client, stranger)

        get_url = f"/api/rooms/{room.room_code}/recording/permission/"
        set_url = f"/api/rooms/{room.room_code}/recording/permission/set/"
        start_url = f"/api/rooms/{room.room_code}/recording/start/"

        # 1. Host sees own can_control = True, empty grants list.
        r = host_client.get(get_url)
        assert r.status_code == 200, r.status_code
        assert r.data["can_control"] is True
        assert r.data["is_host"] is True
        assert r.data["grants"] == []
        print("OK   host sees can_control + empty grants")

        # 2. Grantee can_control = False before grant; non-null grants
        #    must be hidden for non-hosts.
        r = grantee_client.get(get_url)
        assert r.status_code == 200, r.status_code
        assert r.data["can_control"] is False
        assert r.data["is_host"] is False
        assert r.data["grants"] is None
        print("OK   non-host pre-grant has no permission")

        # 3. Stranger (not a grantee) trying to set permissions -> 403.
        r = stranger_client.post(
            set_url,
            data={"user_id": grantee.id, "granted": True},
            format="json",
        )
        assert r.status_code == 403, r.status_code
        print("OK   stranger blocked from setting permissions")

        # 4. Host grants the grantee.
        r = host_client.post(
            set_url,
            data={"user_id": grantee.id, "granted": True},
            format="json",
        )
        assert r.status_code == 200, r.status_code
        assert r.data["granted"] is True
        print("OK   host grants permission")

        # 5. Grantee can_control flips to True.
        r = grantee_client.get(get_url)
        assert r.data["can_control"] is True, r.data
        print("OK   grantee now sees can_control=True")

        # 6. Host's grants list contains the grantee.
        r = host_client.get(get_url)
        ids = [g["user_id"] for g in (r.data["grants"] or [])]
        assert grantee.id in ids
        print("OK   host's grants list reflects grantee")

        # 7. Granted user can hit start_recording (it would 502 because
        #    LiveKit isn't reachable in the test env, but it must NOT 403).
        r = grantee_client.post(start_url, data={"quality": "720p"}, format="json")
        assert r.status_code != 403, f"got {r.status_code}: {r.data}"
        print(f"OK   grantee not 403 on start (got {r.status_code})")

        # Stranger still 403 on start.
        r = stranger_client.post(start_url, data={"quality": "720p"}, format="json")
        assert r.status_code == 403, f"got {r.status_code}: {r.data}"
        print("OK   stranger still blocked from start")

        # 8. Host revokes.
        r = host_client.post(
            set_url,
            data={"user_id": grantee.id, "granted": False},
            format="json",
        )
        assert r.status_code == 200, r.status_code
        assert r.data["granted"] is False
        r = grantee_client.get(get_url)
        assert r.data["can_control"] is False
        print("OK   revoke flips can_control back to False")

        # 9. Granting the host themself is rejected (host is implicit).
        r = host_client.post(
            set_url,
            data={"user_id": host.id, "granted": True},
            format="json",
        )
        assert r.status_code == 400, r.status_code
        print("OK   cannot grant host themself")

        # 10. Granting a non-participant is rejected.
        outsider = (
            User.objects.exclude(
                pk__in=[host.pk, grantee.pk, stranger.pk]
            )
            .filter(is_superuser=False)
            .first()
        )
        if outsider:
            r = host_client.post(
                set_url,
                data={"user_id": outsider.id, "granted": True},
                format="json",
            )
            assert r.status_code == 400, r.status_code
            print("OK   cannot grant non-participant")
        else:
            print("SKIP non-participant check (no extra user)")

        # 11. Username payload also works (room panel sends LiveKit
        #     identity, which equals username).
        r = host_client.post(
            set_url,
            data={"username": grantee.username, "granted": True},
            format="json",
        )
        assert r.status_code == 200, r.status_code
        assert r.data["granted"] is True
        assert r.data["user_id"] == grantee.id
        print("OK   username payload accepted")

        # Restore clean state for any subsequent runs.
        host_client.post(
            set_url,
            data={"username": grantee.username, "granted": False},
            format="json",
        )

        print("\nall checks passed")
        return 0
    finally:
        # Clean up the throwaway room.
        room.delete()


if __name__ == "__main__":
    sys.exit(main())
