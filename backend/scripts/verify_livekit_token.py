"""
One-shot dev helper: mint a LiveKit access token using current Django
settings and call LiveKit's /rtc/validate endpoint. Exits 0 on success
so it can be wired into a CI smoke test later.

Usage:
    backend\\venv\\Scripts\\python.exe backend\\scripts\\verify_livekit_token.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import django
import requests

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402
from livekit import api  # noqa: E402


def mint_token(room: str = "smoke-test", identity: str = "smoke-tester") -> str:
    token = api.AccessToken(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    token.with_identity(identity)
    token.with_name(identity)
    token.with_grants(
        api.VideoGrants(
            room_join=True,
            room=room,
            can_publish=True,
            can_subscribe=True,
        )
    )
    return token.to_jwt()


def main() -> int:
    token = mint_token()
    url = f"{settings.LIVEKIT_HOST_URL.rstrip('/')}/rtc/validate"
    resp = requests.get(url, params={"access_token": token}, timeout=5)
    print(f"GET {url} -> {resp.status_code}")
    print(resp.text)
    return 0 if resp.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
