# Manual server deployment verification

Verified on 2026-08-29 using Linux containers under Docker Desktop, in the isolated Compose project `eduspace-deploy-verify`. No existing development database, media volume or running development service was used.

## Passed

- Backend Docker image build: Python 3.12, project requirements and FFmpeg installed.
- Frontend Docker image build: clean `npm ci`, TypeScript, Vite build and all existing bundle-size budgets.
- Frontend lint and all 72 tests in 16 files, using the final lockfile inside Linux.
- Deployment helper: all 11 standard-library tests inside Linux, including environment isolation, secret generation, rejecting unsafe env input, explicit production confirmation, failed migration handling and incomplete backup markers.
- Backend: all 7 focused signing-secret and server-health tests inside the backend image.
- Standalone server Compose configuration validation; no merge with local Compose.
- All migrations on a new PostgreSQL 16 database; 157 Django static files collected.
- API, web, PostgreSQL, Redis, Gotenberg and Egress health checks; Celery worker ping; Celery Beat startup.
- LiveKit 1.13.6 startup, server API authentication and Egress API request using the generated credentials; Egress 1.14.1 startup.
- Egress writes into a recording directory created through the backend's real entrypoint and shared group permissions.
- Web routing: `/`, `/login`, game assets and Django admin CSS return 200; unauthenticated `/api/auth/me/` returns 401; direct recordings, private media and internal readiness paths return 404 at the public web layer.
- Caddy configuration validation without issuing certificates or binding public ports.
- Backup while application writers were stopped; archive inventory includes recordings and private presentation sources; PostgreSQL dump restored into a separate test database and migration records verified.
- Final npm audit during clean installation reported 0 known vulnerabilities. This is a point-in-time dependency check, not a security audit of the application.
- `git diff --check`.

## Build fixes included

`react-timekeeper` was unused in source but had incompatible React peer requirements, preventing clean installation. It and its unused dependency tree were removed. Compatible lockfile security updates were applied without forced major upgrades. LiveKit's browser SDK is explicitly kept in a lazy vendor chunk so the updated bundler preserves the existing async chunk budget.

## Not verified here

- The complete `server.sh deploy` workflow on the owner's actual Linux host with real DNS, public IPv4, firewall and ACME certificates. The Compose execution sequence and helper behavior were tested separately.
- Public-domain HTTPS/WSS, real two-person WebRTC, restrictive-network TURN behavior, complete browser recording/playback, or target-server capacity.
- The full backend regression suite or full application security audit.
- A complete production disaster-recovery drill. Database restoration and file inventory were checked; restoring a live deployment requires the operator's procedure and approval.

`check --deploy` in staging reports the intentional HSTS-disabled warning and the inherited SAMEORIGIN framing warning. Staging does not enable long-lived HSTS for a shared domain. The test runner also reports Vite's forward-looking `__dirname` warning for the existing Vitest configuration; tests pass.

TURN/UDP is included. TURN/TLS on 443 needs a separate network design and is not claimed as part of this first server package. See [the Persian operator guide](DEPLOY.fa.md).
