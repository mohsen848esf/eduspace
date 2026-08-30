# EduSpace production deployment with Docker Compose and GHCR

This is the canonical production runbook. GitHub builds the backend and web images and publishes them to GitHub Container Registry (GHCR). The Linux server does not build application source and does not run a deployment script.

Publishing an image does not deploy it. The server administrator explicitly chooses when to run Docker Compose.

## Architecture

```text
approved Git ref -> GitHub Actions -> GHCR backend/web images
                                      |
                                      v
Linux server -> Docker Compose -> storage -> migrations -> static files -> application
```

Application images:

```text
ghcr.io/mohsen848esf/eduspace-backend
ghcr.io/mohsen848esf/eduspace-web
```

Each build receives an immutable `sha-<commit>` tag. A successful explicit promotion moves the `production` tag for both images. Do not use `latest`.

## Release responsibilities

The project owner:

1. Selects a tested Git ref or commit.
2. Opens **Actions -> Publish production images -> Run workflow**.
3. Enters the exact ref and enables **promote_production**, or publishes a GitHub Release.
4. Waits until the quality, image publication, and promotion jobs all pass.
5. Gives the server administrator the immutable `sha-...` tag for the release record and rollback.

The workflow runs frontend lint/tests/build, backend checks/tests, builds both Docker images, publishes immutable images, verifies both exist, and only then moves their `production` tags. It never connects to the server.

## One-time server preparation

Requirements:

- Docker Engine and Docker Compose v2.24 or newer.
- An `x86_64`/`amd64` host. Confirm with `uname -m`; the published application images currently target `linux/amd64`.
- Git access to the repository for the initial infrastructure checkout.
- Two DNS-only A records pointing to the server public IPv4: one application hostname and one RTC hostname.
- A trusted HTTPS reverse proxy.
- Outbound HTTPS access to `ghcr.io`.

Clone the approved infrastructure version:

```bash
git clone https://github.com/mohsen848esf/eduspace.git eduspace
cd eduspace
git checkout --detach APPROVED_COMMIT_SHA
```

### Private GHCR packages

Public packages can be pulled without login. For private packages, create a dedicated classic GitHub token with only `read:packages`, then log in once:

```bash
read -rsp 'GHCR read token: ' GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
unset GHCR_TOKEN
```

Do not put this token in the repository, production env, Compose file, or shell history. Protect the deployment account's Docker credential file.

### Production environment

```bash
umask 077
mkdir -p .deploy
cp infra/server/.env.example .deploy/production.env
chmod 600 .deploy/production.env
nano .deploy/production.env
```

Replace all domains, public IP, and generated secret placeholders. Generate three different values with `openssl rand -hex 32` for `SECRET_KEY`, `DB_PASSWORD`, and `LIVEKIT_API_SECRET`.

Core production values:

```dotenv
DEPLOY_ENV=production
APP_DOMAIN=meet.example.com
RTC_DOMAIN=rtc.example.com
PUBLIC_IP=203.0.113.10
EDGE_MODE=external
WEB_PORT=8081
RTC_HTTP_PORT=7890
RTC_TCP_PORT=7881
RTC_UDP_PORT=7882
TURN_UDP_PORT=3478
BACKEND_IMAGE=ghcr.io/mohsen848esf/eduspace-backend
WEB_IMAGE=ghcr.io/mohsen848esf/eduspace-web
RELEASE_TAG=production
```

`WEB_PORT` and `RTC_HTTP_PORT` bind to host loopback. The reverse proxy uses them. The media ports are public.

The env is now the only source for LiveKit's public IP and ports. Compose generates `/etc/livekit.yaml` directly from these values. Do not create or mount another LiveKit YAML. Any valid custom port values work when the host firewall and provider firewall use the same values.

The conventional public LiveKit ports shown above are:

| Port | Protocol | Purpose |
| --- | --- | --- |
| `7881` | TCP | ICE/TCP media fallback |
| `7882` | UDP | ICE/UDP mux media |
| `3478` | UDP | embedded TURN/STUN |

Open the selected `RTC_TCP_PORT` over TCP and `RTC_UDP_PORT`/`TURN_UDP_PORT` over UDP. Open TCP 80/443 for the reverse proxy. Never expose PostgreSQL, Redis, Django, Gotenberg, `WEB_PORT`, or `RTC_HTTP_PORT` publicly.

Create the external proxy network once:

```bash
docker network inspect eduspace-edge >/dev/null 2>&1 || docker network create eduspace-edge
```

Validate configuration without printing resolved secrets:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml config --quiet
```

Never paste the full output of `docker compose config`; resolved service env can contain secrets.

### Existing host Nginx

Use separate HTTPS server blocks with valid certificates. Preserve existing sites.

```nginx
# meet.example.com HTTPS server
location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    client_max_body_size 110m;
}

# rtc.example.com HTTPS server
location / {
    proxy_pass http://127.0.0.1:7890;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

Validate before reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If the reverse proxy runs in Docker, attach it to `eduspace-edge` and use `eduspace-production-web:80` and `eduspace-production-rtc:7880`; container loopback is not the host.

## First deployment and routine updates

The same command handles both:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml up -d --pull always --wait
```

Compose performs this order:

1. Pull the promoted backend and web images from GHCR.
2. Start/check PostgreSQL and Redis and initialize volume permissions.
3. Run `python manage.py migrate --noinput` in a one-shot container.
4. Run `python manage.py collectstatic --noinput` in a one-shot container.
5. Start the backend and wait for readiness.
6. Start web, workers, Beat, LiveKit, Egress, and Gotenberg.

If migration or static collection fails, the new backend does not start. Stop and inspect logs; never delete a volume to fix a migration.

For ordinary application releases, the server checkout does not need `git pull`; Compose only pulls images. When `compose.server.yml`, proxy configuration, or infrastructure files change, checkout the specifically approved infrastructure commit first, validate it, then run the same update command.

This is not a zero-downtime migration system. Schema changes used in routine releases must be backward compatible. Breaking data migrations require a maintenance window, a verified backup, and an explicit recovery plan.

Create the first administrator only once:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec backend python manage.py createsuperuser
```

## Status and logs

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml ps --all
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml logs --tail=200 backend worker livekit egress
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec -T worker celery -A config inspect ping --timeout=10
```

After every update, test login, organization context, a two-device call from different networks, microphone/camera/screen share, document conversion, recording, and unauthorized recording access. HTTPS and signaling success alone do not verify media ports.

## Release record and rollback

Record the immutable tag reported by the publish workflow, for example:

```text
sha-0123456789ab
```

To roll application images back, edit:

```dotenv
RELEASE_TAG=sha-0123456789ab
```

Then run the normal Compose update command. Both backend and web return to the same source revision.

Returning to old images does not reverse database migrations. Confirm schema compatibility before rollback. To follow future promoted releases again, restore `RELEASE_TAG=production`.

## Backup boundary

Image updates do not back up production data. Before a release containing migrations, take and verify a database/file backup during a quiet maintenance window. Keep an encrypted off-host copy.

Never use these as troubleshooting shortcuts:

```text
docker compose down -v
docker volume prune
git clean -fdx
deleting .deploy
```

They can destroy production data or credentials.

## Caddy alternative

If this project owns host ports 80/443, `compose.edge.yml` can run the repository Caddy service. Create `.deploy/edge/production.caddy` with the two domains and Docker aliases, validate it, then run:

```bash
docker compose -p eduspace-edge -f compose.edge.yml up -d
```

Do not start it when another reverse proxy already owns 80/443.
