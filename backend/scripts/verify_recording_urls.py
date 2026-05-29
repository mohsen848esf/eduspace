"""
Smoke test: confirms the recording URL routes resolve to the right view
callables. Useful as a CI guard.
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

from django.urls import reverse  # noqa: E402

CASES = [
    # Control plane
    ('recording_start', {'room_code': 'ABC123'}, '/api/rooms/ABC123/recording/start/'),
    ('recording_stop', {'room_code': 'ABC123'}, '/api/rooms/ABC123/recording/stop/'),
    ('recording_pause', {'room_code': 'ABC123'}, '/api/rooms/ABC123/recording/pause/'),
    ('recording_resume', {'room_code': 'ABC123'}, '/api/rooms/ABC123/recording/resume/'),
    ('recording_status', {'room_code': 'ABC123'}, '/api/rooms/ABC123/recording/status/'),

    # Webhook
    ('recording_webhook', {}, '/api/recordings/webhook/'),

    # Library
    ('recording_list', {}, '/api/recordings/'),
    ('recording_detail', {'token': 'AbC_123-xyz'}, '/api/recordings/AbC_123-xyz/'),
    ('recording_stream', {'token': 'AbC_123-xyz'}, '/api/recordings/AbC_123-xyz/stream/'),
]


def main() -> int:
    failures = 0
    for name, kwargs, expected in CASES:
        actual = reverse(name, kwargs=kwargs)
        ok = actual == expected
        marker = 'OK' if ok else 'FAIL'
        print(f'{marker:4s} {name:22s} -> {actual} (expected {expected})')
        if not ok:
            failures += 1
    return 0 if failures == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
