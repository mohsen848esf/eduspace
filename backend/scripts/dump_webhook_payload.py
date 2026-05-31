"""
One-shot helper: starts a tiny aiohttp server on :8765 that prints
every incoming POST body so we can confirm the LiveKit egress webhook
JSON shape.

Usage:
  1. Run this script in a separate terminal.
  2. Temporarily add http://host.docker.internal:8765/ to webhook.urls
     in infra/livekit/livekit.yaml and `docker compose restart livekit`.
  3. Trigger an egress; the body will print here.
  4. Revert the yaml + restart livekit.
"""

from __future__ import annotations

import asyncio
from aiohttp import web


async def handler(request: web.Request) -> web.Response:
    body = await request.read()
    print('---', request.method, request.path, '---')
    print('headers:', dict(request.headers))
    print('body:')
    print(body.decode(errors='replace'))
    print()
    return web.Response(text='ok')


async def main() -> None:
    app = web.Application()
    app.router.add_route('*', '/{tail:.*}', handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8765)
    await site.start()
    print('listening on :8765')
    while True:
        await asyncio.sleep(3600)


if __name__ == '__main__':
    asyncio.run(main())
