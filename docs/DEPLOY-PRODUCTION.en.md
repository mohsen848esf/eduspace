# EduSpace: manual production deployment

This guide is for a Linux administrator who has Docker running and access to the GitHub repository. It deploys directly to **production**, without staging, CI/CD, or a deployment script. Run the commands yourself, one step at a time.

The repository already contains the Dockerfiles and Compose configuration. You do not need to install Python, Node.js, Django, or PostgreSQL on the host. Application builds and management commands run inside containers.

**Scope:** one Linux server, one production installation, two public hostnames, and persistent Docker volumes. This is not a high-availability or zero-downtime deployment. Keep real users out until the acceptance checks pass.

## 1. Collect the information and check the server

The project owner must provide:

- Read access to `https://github.com/mohsen848esf/eduspace` and the full commit SHA approved for this release.
- An application hostname, such as `app.example.com`.
- A separate LiveKit hostname, such as `rtc.example.com`.
- The server's public IPv4 address and permission to configure DNS and the required firewall rules.
- A decision about HTTPS: use the project's Caddy container, or the server's existing reverse proxy.
- Any credentials for external services actually needed at launch, such as SMTP.

Throughout this guide, replace `app.example.com`, `rtc.example.com`, `203.0.113.10`, and `APPROVED_COMMIT_SHA` with real values. Do not deploy with example values.

Use a Linux account allowed to run Docker. Docker access grants powerful control over the host; restrict it to trusted administrators. Check:

```bash
docker version
docker compose version
git --version
openssl version
curl --version
docker ps
ss -lntup
df -h
free -h
```

Use Docker Compose v2.24 or newer. The host also needs an editor, standard Linux archive utilities, and outbound access to GitHub, Docker Hub, PyPI, npm, Debian package repositories, and the certificate authority. Allow space for builds, database growth, uploads, recordings, and backups. Recording and document conversion share resources with the application; verify capacity under your expected load.

Choose **one** HTTPS path:

| Server situation | Choice | Later step |
| --- | --- | --- |
| TCP ports 80 and 443 are free and this project may own them | Caddy | 10A |
| Nginx, Caddy, Traefik, or another proxy already owns those ports | Existing proxy | 10B |

Do not stop existing websites to make room for this project.

## 2. Configure DNS and networking

Create two DNS A records pointing directly to the server:

| Hostname | Address |
| --- | --- |
| `app.example.com` | Your public IPv4 |
| `rtc.example.com` | The same public IPv4 |

For this deployment, use DNS-only records, without a CDN HTTP proxy. Remove stale AAAA records unless IPv6 is deliberately configured end to end. Confirm the names resolve correctly before starting HTTPS.

Allow these inbound ports in both the provider firewall and the host's Docker-aware firewall policy. Keep existing SSH access available. If the server uses NAT, forward the media ports unchanged to this host.

| Port | Protocol | Purpose | Exposure |
| --- | --- | --- | --- |
| 80, 443 | TCP | HTTP redirect, HTTPS, certificate issuance | Public reverse proxy |
| 7891 | TCP | LiveKit media fallback | Public |
| 7892 | UDP | LiveKit media mux | Public |
| 3479 | UDP | Embedded TURN/STUN | Public |
| 8081 | TCP | Application upstream | `127.0.0.1` only |
| 7890 | TCP | LiveKit signaling upstream | `127.0.0.1` only |

Do not expose PostgreSQL, Redis, Gotenberg, or Django directly. Leave the loopback bindings in `compose.server.yml` unchanged. The internal web server assumes a trusted HTTPS proxy; public plain HTTP access to that server is not supported.

This configuration uses a single UDP mux port, so it does not need the 50000–60000 UDP range. TURN/UDP is configured; TURN/TLS on port 443 is **not**. Calls may fail on networks that block the configured media transports. Adding TURN/TLS requires a separate network design; another DNS record alone does not solve the port conflict. See the [LiveKit ports reference](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## 3. Download the approved version

From a directory owned by your deployment account:

```bash
git clone --branch develop --single-branch https://github.com/mohsen848esf/eduspace.git eduspace
cd eduspace
git checkout --detach APPROVED_COMMIT_SHA
git rev-parse HEAD
git status --short
```

For a private repository, use the administrator's approved GitHub authentication method, such as a read-only SSH deploy key. Never put access tokens in the clone URL, application env, or this document.

Check that the displayed SHA is the approved version and that the checkout has no unexpected changes. The `develop` branch is only the download source; production should run a specific reviewed commit. A push to GitHub or a Git checkout does not update running containers automatically.

Run all remaining commands from this repository root. Use **`compose.server.yml` only** for the application. Do not combine it with the local `docker-compose.yml` or run bare `docker compose up`.

## 4. Create the production environment file

This section is for a **new** production installation. If `.deploy/production.env` or production volumes already exist, preserve them and use the update procedure in step 14. Do not overwrite existing credentials.

```bash
umask 077
mkdir -p .deploy/production .deploy/edge
chmod 700 .deploy .deploy/production
chmod 755 .deploy/edge
cp -n infra/server/.env.example .deploy/production.env
chmod 600 .deploy/production.env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
nano .deploy/production.env
```

Save the three different random values securely. Use them for `SECRET_KEY`, `DB_PASSWORD`, and `LIVEKIT_API_SECRET`, respectively. Do not share terminal output containing secrets.

The example env defaults to **staging**. Replace its first block with the following production values, substituting your actual domains, IP, and generated secrets:

```dotenv
DEPLOY_ENV=production
APP_DOMAIN=app.example.com
RTC_DOMAIN=rtc.example.com
PUBLIC_IP=203.0.113.10
EDGE_MODE=caddy
WEB_PORT=8081
RTC_HTTP_PORT=7890
RTC_TCP_PORT=7891
RTC_UDP_PORT=7892
TURN_UDP_PORT=3479
SECRET_KEY=REPLACE_WITH_FIRST_RANDOM_VALUE
DB_NAME=eduspace
DB_USER=edu
DB_PASSWORD=REPLACE_WITH_SECOND_RANDOM_VALUE
LIVEKIT_API_KEY=eduproduction
LIVEKIT_API_SECRET=REPLACE_WITH_THIRD_RANDOM_VALUE
LIVEKIT_IMAGE=livekit/livekit-server:v1.13.6
EGRESS_IMAGE=livekit/egress:v1.14.1
```

Set `EDGE_MODE=external` if using the existing proxy. In this manual workflow, `EDGE_MODE` is a record of your choice; Compose does not start or configure the proxy based on it. You must follow step 10A or 10B yourself.

`LIVEKIT_API_KEY` is an identifier, not the secret. Keep it identical in the env and the LiveKit YAML created in step 5. Use separate secrets for this environment. Do not regenerate them on each deployment.

Keep the remaining settings from the example. Review these optional groups before launch:

| Variables | Purpose / initial choice |
| --- | --- |
| `RECORDING_DEFAULT_QUALITY`, `RECORDING_MAX_DURATION_SECONDS` | Recording quality and maximum duration; initial values are `720p` and `14400` seconds. |
| `PRESENTATION_MAX_UPLOAD_BYTES`, `PRESENTATION_MAX_OUTPUT_BYTES`, `PRESENTATION_MAX_PAGES`, `PRESENTATION_MAX_IMAGE_PIXELS`, `PRESENTATION_CONVERSION_TIMEOUT_SECONDS` | Document conversion limits; start with the example values. |
| `S3_ENABLED` | Keep `False` for initial deployment using Docker volumes. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `CDN_URL` | Optional recording storage integration. This does not move all application files to S3; review recording access controls before using a CDN. |
| `SENTRY_DSN` | Optional backend error reporting. |
| `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` | Email delivery. The default console backend logs messages and **does not send email**. For SMTP, use `django.core.mail.backends.smtp.EmailBackend` and your provider's settings. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Optional SMS integration; verify the actual application flow before relying on it. |
| `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional payment integration; configure and test the intended payment flow separately. |

Adding credentials does not implement unfinished application features. Do not promise email, SMS, or payments until their complete workflows have been tested.

Env rules:

- Use one `KEY=value` per line. Do not execute or `source` the file as a shell script.
- Use the generated hexadecimal values for core secrets. For provider credentials containing special characters, follow Docker Compose env quoting rules; literal dollar signs need care to avoid interpolation.
- Do not copy `backend/.env`, frontend development env files, local databases, or personal media onto the server.
- Do not commit `.deploy`. It is ignored by Git and excluded from the Docker build context, but still contains sensitive data on disk.
- Changing `DB_PASSWORD` in this file does **not** change an existing PostgreSQL user's password. Credential rotation requires a coordinated database operation.

Compose supplies the internal settings: `DJANGO_SETTINGS_MODULE=config.server_settings`, `DEBUG=False`, `USE_SQLITE=False`, `DB_HOST=db`, `DB_PORT=5432`, `REDIS_HOST=redis`, `GOTENBERG_URL=http://gotenberg:3000`, `LIVEKIT_HOST_URL=http://livekit:7880`, `LIVEKIT_WS_URL=wss://<RTC_DOMAIN>`, and `RECORDING_OUTPUT_DIR=media/recordings`. Do not replace these internal hostnames with public URLs.

The browser frontend uses its current origin for API and application WebSocket requests. No production `VITE_API_URL` is required. Allowed hosts, CORS, and CSRF settings are derived from `APP_DOMAIN`.

## 5. Create the LiveKit configuration

```bash
nano .deploy/production/livekit.yaml
```

Save this content, replacing the example public IP. If you changed `LIVEKIT_API_KEY`, also replace `eduproduction` below:

```yaml
port: 7880
rtc:
  tcp_port: 7891
  udp_port: 7892
  node_ip: 203.0.113.10
  use_external_ip: false
  advertise_internal_ip: true
redis:
  address: redis:6379
turn:
  enabled: true
  udp_port: 3479
webhook:
  api_key: eduproduction
  urls:
    - http://backend:8000/api/recordings/webhook/
```

```bash
chmod 644 .deploy/production/livekit.yaml
```

This YAML contains no API secret; Compose supplies credentials from the env. The file must be readable by the LiveKit container. The private parent directory remains restricted on the host.

`PUBLIC_IP` in the env does not generate this file in a manual deployment. Keep the YAML `node_ip` and public media ports synchronized with the env and firewall rules. The internal signaling port stays `7880`, even though its host loopback port is `7890`.

Keep the repository's `infra/server/egress.yaml` unchanged. Recording output is shared between the backend and Egress through a dedicated Docker volume.

## 6. Set the Compose context and create the shared network

Use a clean shell without unrelated exported application variables: shell variables can override values supplied through `--env-file`.

```bash
export SERVER_ENV_FILE="$PWD/.deploy/production.env"
export SERVER_CONFIG_DIR="$PWD/.deploy/production"
export RELEASE_ID="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
printf '%s\n' "$RELEASE_ID"
docker network inspect eduspace-edge
```

If the last command reports that the network does not exist, create it:

```bash
docker network create eduspace-edge
```

If it already exists, verify it is the intended shared proxy network; do not remove or replace it. The application needs this external network even when using a host reverse proxy.

Use these exports in the same shell for the remaining steps. `RELEASE_ID` tags the backend and frontend images. Do not change it halfway through a release. On a later login, restore the active release as shown in step 12 rather than generating a new ID for routine management.

Validate Compose without printing resolved secrets:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml config --quiet
```

Manually recheck `DEPLOY_ENV=production`, both domains, all ports, matching LiveKit identifiers, and that no `GENERATED_BY_INIT` or replacement placeholders remain. Compose validation does not detect every wrong value or test DNS, firewall rules, or real calls.

**Every application command below deliberately includes the env file, project name, and Compose file. Stop after any failed command and resolve the cause before continuing. There is no script here to enforce production confirmations or stop the next command for you.**

## 7. Build and download the images

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml build backend web
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml pull db redis livekit egress gotenberg
```

Build completion is required before continuing. Dependencies are downloaded during the builds; a successful clone alone is not enough. Keep old release images until the rollback window has closed. Do not substitute `latest` for the selected LiveKit or Egress tags.

## 8. Initialize storage and prepare the database

For a fresh installation:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml up -d --wait --wait-timeout 180 db redis gotenberg
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml run --rm --no-deps init-storage
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml run --rm --no-deps backend python manage.py check --deploy
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml run --rm --no-deps backend python manage.py migrate --noinput
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml run --rm --no-deps backend python manage.py collectstatic --noinput
```

The storage command initializes ownership and shared recording permissions. Migrations create the database schema; `collectstatic` prepares Django admin assets. Review deployment-check warnings rather than ignoring them. The inherited `SAMEORIGIN` framing configuration can produce warning `security.W019`; evaluate it against the application's framing requirements.

If this is an update or any production data already exists, stop application writers and take the backup in step 13 **before migrations**. Never delete volumes to fix a migration or password error.

## 9. Start the application services

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml up -d --wait --wait-timeout 240
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml ps --all
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec -T worker celery -A config inspect ping --timeout=10
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml logs --tail=100 backend worker beat livekit egress
```

Expect healthy services where health checks are defined, a Celery worker `pong`, and no repeated crashes. `init-storage` is a one-time service: exit code 0 is expected, not a fault. `--wait` does not prove that LiveKit media, Celery Beat scheduling, or recording works; examine their logs and run the acceptance tests.

## 10A. HTTPS with the project's Caddy container

Follow this path only if you selected Caddy. Otherwise go to step 10B.

Create a production site snippet without overwriting other environments' snippets:

```bash
nano .deploy/edge/production.caddy
```

Use your actual hostnames:

```caddyfile
app.example.com {
    reverse_proxy eduspace-production-web:80
}

rtc.example.com {
    reverse_proxy eduspace-production-rtc:7880
}
```

```bash
chmod 644 .deploy/edge/production.caddy
docker compose -p eduspace-edge -f compose.edge.yml pull edge
docker compose -p eduspace-edge -f compose.edge.yml run --rm --no-deps edge caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -p eduspace-edge -f compose.edge.yml up -d
docker compose -p eduspace-edge -f compose.edge.yml exec -T edge caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -p eduspace-edge -f compose.edge.yml logs --tail=100 edge
```

The proxy uses a separate project, `eduspace-edge`, shared by environments on this checkout. Preserve its certificate volumes and other site snippets. The reload also applies the new site if this edge container was already running.

Caddy obtains and renews certificates and redirects HTTP to HTTPS when DNS, public reachability, and persistent certificate storage are correct. If certificate issuance fails, resolve the cause before proceeding. See [Caddy's automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https).

Continue at step 11.

## 10B. HTTPS with an existing reverse proxy

Do **not** start `compose.edge.yml` on this path. Keep the existing proxy and its other sites running.

The administrator must add HTTPS virtual hosts for both domains, obtain valid certificates using the server's existing certificate procedure, enable renewal, and redirect HTTP to HTTPS. The following are location blocks for **two separate, already configured HTTPS Nginx server blocks**; they are not a complete replacement for the server's Nginx configuration.

```nginx
# Inside the HTTPS server block for app.example.com:
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

# Inside the separate HTTPS server block for rtc.example.com:
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

For a host-installed Nginx managed by systemd, validate before reloading:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Run the reload only if validation succeeds. Adapt the validation/reload procedure if your proxy is managed differently.

For a proxy **inside Docker**, its `127.0.0.1` is not the Linux host. Attach that proxy to `eduspace-edge` through its managed configuration and use `eduspace-production-web:80` and `eduspace-production-rtc:7880` as upstreams. Only trusted proxies should join this network. Preserve WebSocket upgrades and HTTPS on both hostnames.

## 11. Create an administrator and test before admitting users

Create your own administrator interactively:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec backend python manage.py createsuperuser
```

Do not put the administrator's password in env or shell history. On a fresh database, existing migrations create a `Default Academy` and a `system_admin` account without a usable login password. That account is not your personal administrator. Configure organization ownership and membership through the application or admin; creating a superuser does not automatically establish all application memberships. Do not run old demo-data seed commands on production.

From a machine outside the server, using the real domains:

```bash
curl --fail --show-error https://app.example.com/healthz
curl --fail --show-error https://app.example.com/login -o /dev/null
curl --fail --show-error https://rtc.example.com/
curl -s -o /dev/null -w '%{http_code}\n' https://app.example.com/api/auth/me/
curl -s -o /dev/null -w '%{http_code}\n' https://app.example.com/media/recordings/test.mp4
curl -s -o /dev/null -w '%{http_code}\n' https://app.example.com/private_media/test.pdf
curl -s -o /dev/null -w '%{http_code}\n' https://app.example.com/readyz/
```

Expect the first three requests to succeed, unauthenticated `/api/auth/me/` to return 401, and the final three paths to return 404. Do not bypass certificate verification with `curl -k`. `/healthz` verifies the web container only; the backend's private `/readyz/` check covers database and Redis connectivity.

Complete these browser checks with test accounts before launch:

- Open the login page and `/admin/`; check valid HTTPS and working styles/assets.
- Test the actual login flow and organization/classroom permissions.
- Join one room from two devices on different networks. Test microphone, camera, screen sharing, and reconnecting.
- Upload a PDF and an Office document; confirm background conversion finishes.
- Start and stop a recording, wait for processing, and play it through the authenticated application. Confirm an unauthorized account cannot access the real recording; the dummy-path checks above are not an authorization test.
- Test any notification, email, SMS, or payment feature you intend to use.
- During a planned test window without active calls, verify that restarting services preserves accounts and files. Verify host reboot recovery before relying on unattended operation.

The project has previously been checked with Linux containers; see `docs/DEPLOY-VERIFICATION.md` for the exact scope. That does **not** verify your server's DNS, TLS, real calls, recording, or capacity. Skipping staging does not remove these acceptance checks.

## 12. Record the release and manage the running installation

After the checks pass, record the active image tag and commit, and retain the matching configuration:

```bash
printf '%s\n' "$RELEASE_ID" > .deploy/production/active-release.txt
git rev-parse HEAD > .deploy/production/active-commit.txt
cp .deploy/production.env .deploy/production/active.env
cp .deploy/production/livekit.yaml .deploy/production/active-livekit.yaml
chmod 600 .deploy/production/active.env
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml images
```

Keep an operator record of the date, image IDs, test results, and any accepted limitations. These manual records do not create the deployment helper's metadata; do not switch between manual and helper-based deployment without reconciling their state.

On a **new SSH session**, first enter this same repository root, then restore the context:

```bash
export SERVER_ENV_FILE="$PWD/.deploy/production.env"
export SERVER_CONFIG_DIR="$PWD/.deploy/production"
export RELEASE_ID="$(cat .deploy/production/active-release.txt)"
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml ps --all
```

View logs or resource use:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml logs --tail=200 backend worker livekit egress
docker stats --no-stream
```

Logs may contain personal data or console email contents. Restrict access and redact them before sharing.

## 13. Take a consistent backup

Take a backup before each update and establish a regular backup policy with the server administrator. This document does not install a scheduler. Store an encrypted copy off the server and test restoration; a backup on the same disk does not protect against disk loss.

Use the active release context from step 12, the matching checkout, and unchanged active env. Schedule downtime, prevent new sessions, and finish calls, recordings, and background jobs first. No other tool or process may write to these database/files during the backup.

```bash
umask 077
export BACKUP_DIR="$PWD/.deploy/production/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml stop web beat worker egress livekit backend
```

Leave PostgreSQL and Redis running. With the `DB_USER=edu` and `DB_NAME=eduspace` values from this guide, run:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec -T db pg_dump -U edu -d eduspace -Fc > "$BACKUP_DIR/database.dump"
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml run --rm --no-deps -T --entrypoint tar backend -czf - -C /app media private_media > "$BACKUP_DIR/files.tar.gz"
cp .deploy/production/active.env "$BACKUP_DIR/production.env"
cp .deploy/production/active-livekit.yaml "$BACKUP_DIR/livekit.yaml"
cp .deploy/production/active-release.txt .deploy/production/active-commit.txt "$BACKUP_DIR/"
```

If you chose different database/user names, substitute them in the dump command. The archive includes public media, the nested recording volume, and private presentation sources. Static assets can be rebuilt; Redis queues are not included in this backup.

**Check each command's exit status before continuing.** Redirection can leave an empty or partial file after a failure. Inspect both archives:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec -T db pg_restore --list < "$BACKUP_DIR/database.dump"
tar -tzf "$BACKUP_DIR/files.tar.gz"
```

Archive listing is a basic integrity check, not a restore drill. Retain the corresponding application images. Encrypt and copy the backup to your approved off-host storage. Record a backup as complete only after all commands and checks succeed.

For a standalone backup, resume the unchanged release and check it:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml up -d --wait --wait-timeout 240
```

If immediately updating, leave the application stopped and proceed to step 14 instead. A failure does not automatically restart services; the administrator must decide whether to resume the unchanged release or investigate while offline.

## 14. Deploy a later production version

This simple manual procedure has downtime during backup, build, migrations, and restart. Announce a maintenance window. Do not perform it during classes or recordings.

1. Get the new approved commit SHA from the project owner. Keep the current image tags, commit, and configuration for recovery.
2. Complete step 13 using the current release. Leave application writers stopped and verify the backup before proceeding.
3. Fetch and select the new version:

   ```bash
   git fetch origin develop
   git checkout --detach APPROVED_COMMIT_SHA
   git rev-parse HEAD
   export RELEASE_ID="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
   ```

4. Review release notes for configuration or migration requirements. Preserve `.deploy`, existing secrets, project name, and volumes. Do not repeat the initial env-copy or secret-generation steps.
5. Validate the new Compose configuration as in step 6, then repeat steps 7–9 with the new release ID. Stop at the first error. If a migration fails, do not start a mixed old/new application.
6. If proxy configuration changed, validate and reload it using the selected path in step 10. Otherwise keep the existing proxy running.
7. Repeat step 11's acceptance checks; do not create another superuser unless needed. After success, update the active records in step 12 and reopen access.

For a release with no incompatible database changes, returning to a retained previous image may be possible after compatibility review. **Checking out old code alone does not undo migrations.**

If data restoration is required, first obtain approval for the loss of changes after the selected backup. Stop writers, back up the failed/current state, and restore the database and file archives together into the explicitly chosen target. Use compatible application images and credentials. Preserve backend UID `10001` and shared group GID `2000` permissions. Review queued Redis jobs before resuming; jobs can reference records that no longer exist after a restore. Rehearse this in an isolated environment before attempting production recovery.

Never use `docker compose down -v`, volume pruning, `git clean -fdx`, or deletion of `.deploy` as a troubleshooting shortcut.

## 15. Troubleshooting and environment separation

| Symptom | Check |
| --- | --- |
| Port 80/443 is already in use | Use the existing-proxy path; do not stop unrelated sites. |
| Certificate issuance fails | DNS A/AAAA records, reachability of 80/443, outbound access, and proxy logs. |
| Site loads but calls fail | Public IP in LiveKit YAML, 7891/TCP, 7892/UDP, 3479/UDP, NAT, and client-network restrictions. |
| Database authentication fails after an env edit | The persisted database password does not change with env. Restore the previous configuration or perform coordinated credential rotation. |
| Document conversion stalls | Worker logs, the `documents` queue, and Gotenberg health/resources. |
| Recording fails | LiveKit/Egress logs, API key matching, available resources, `SYS_ADMIN` support, and shared volume permissions. |
| HTTP 502 or unhealthy backend | Backend logs, successful migrations, PostgreSQL/Redis health, and correct proxy upstreams. |
| Build cannot download dependencies | Host access to the required registries and package repositories. |

Local development continues to use the existing local Compose file and local env. This guide does not change those files. Production uses `eduspace-production`, its own secrets, its own named volumes, and its own media ports. Staging can be added later with separate configuration and ports; it is not a prerequisite for this installation. Do not point a future staging environment at production data or credentials.
