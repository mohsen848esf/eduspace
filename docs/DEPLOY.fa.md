# استقرار Production با Docker Compose و GHCR

این راهنمای اصلی استقرار سرور است. GitHub imageهای backend و frontend را می‌سازد و در GHCR قرار می‌دهد. سرور کد برنامه را build نمی‌کند و هیچ اسکریپت Bash برای deploy اجرا نمی‌شود.

انتشار image به معنی deploy خودکار نیست؛ مدیر سرور زمان اجرای Compose را تعیین می‌کند.

## انتشار نسخه توسط مالک پروژه

1. commit یا ref تست‌شده را مشخص کنید.
2. در GitHub به **Actions -> Publish production images -> Run workflow** بروید.
3. ref دقیق را وارد و گزینهٔ `promote_production` را فعال کنید؛ یا یک GitHub Release منتشر کنید.
4. منتظر موفقیت کامل quality، انتشار هر دو image و promotion بمانید.
5. tag تغییرناپذیر `sha-...` را برای ثبت نسخه و rollback نگه دارید.

Imageها:

```text
ghcr.io/mohsen848esf/eduspace-backend
ghcr.io/mohsen848esf/eduspace-web
```

`production` فقط با promotion صریح جابه‌جا می‌شود. از `latest` استفاده نمی‌کنیم. GitHub به سرور وصل نمی‌شود و deployment خودکار نداریم.

## آماده‌سازی یک‌بارهٔ سرور

نیازمندی‌ها:

- Docker Engine و Docker Compose نسخهٔ ۲.۲۴ یا جدیدتر
- معماری `x86_64`/`amd64`؛ با `uname -m` بررسی کنید. imageهای فعلی برنامه برای `linux/amd64` منتشر می‌شوند.
- Git برای دریافت اولیهٔ فایل‌های زیرساخت
- دو رکورد A مستقیم برای دامنهٔ برنامه و دامنهٔ RTC
- reverse proxy معتبر با HTTPS
- دسترسی خروجی سرور به `ghcr.io`

```bash
git clone https://github.com/mohsen848esf/eduspace.git eduspace
cd eduspace
git checkout --detach APPROVED_COMMIT_SHA
```

اگر packageهای GHCR خصوصی هستند، یک token اختصاصی با دسترسی فقط `read:packages` بسازید و یک بار login کنید:

```bash
read -rsp 'GHCR read token: ' GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
unset GHCR_TOKEN
```

token را داخل env پروژه، Compose، URL یا history قرار ندهید.

### env تولید

```bash
umask 077
mkdir -p .deploy
cp infra/server/.env.example .deploy/production.env
chmod 600 .deploy/production.env
nano .deploy/production.env
```

برای `SECRET_KEY`، `DB_PASSWORD` و `LIVEKIT_API_SECRET` سه مقدار متفاوت با `openssl rand -hex 32` بسازید. دامنه‌ها، IP و همهٔ placeholderها را جایگزین کنید.

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

پورت‌ها و IP فقط در همین env تعریف می‌شوند. Compose فایل داخلی LiveKit را از همین مقادیر تولید می‌کند؛ فایل `livekit.yaml` دیگری نسازید و mount نکنید. بنابراین پورت publishشده و پورتی که LiveKit advertise می‌کند همیشه یکی است.

### ذخیره‌سازی سینمای آنلاین

آپلود و پخش HLS سینمای آنلاین مستقیماً به یک object storage سازگار با S3 نیاز دارد و روی فایل‌سیستم کانتینر ذخیره نمی‌شود. این مقادیر را قبل از اجرای stack در `.deploy/production.env` قرار دهید:

```dotenv
S3_ENABLED=True
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=eduspace-media
AWS_S3_ENDPOINT_URL=                 # برای AWS خالی؛ برای R2/MinIO آدرس HTTPS سرویس
AWS_S3_REGION_NAME=us-east-1        # برای Cloudflare R2 مقدار auto
AWS_S3_ADDRESSING_STYLE=auto
MEDIA_PROGRESSIVE_UPLOAD_ENABLED=False
MEDIA_PROGRESSIVE_INGEST_ENABLED=False
```

روی bucket باید CORS مبدأ برنامه اجازهٔ `PUT` امضاشده بدهد و header `ETag` را expose کند. پس از اطمینان از سلامت media-worker و اجرای FFmpeg، هر دو فلگ progressive را `True` کنید تا پخش حین آپلود فعال شود؛ در غیر این صورت مسیر آپلود resumable کامل استفاده می‌شود. نبودن این تنظیمات عمداً باعث پاسخ `503 STORAGE_NOT_CONFIGURED` در endpoint آغاز آپلود می‌شود.

پورت‌های عمومی نمونه:

| پورت | پروتکل | کاربرد |
| --- | --- | --- |
| `7881` | TCP | رسانهٔ جایگزین ICE/TCP |
| `7882` | UDP | رسانهٔ اصلی ICE/UDP mux |
| `3478` | UDP | TURN/STUN داخلی LiveKit |

همین مقادیر را در فایروال لینوکس، پنل سرور و NAT باز کنید. پورت‌های `8081` و `7890` فقط روی loopback هستند. PostgreSQL، Redis، Django و Gotenberg نباید عمومی شوند.

شبکهٔ proxy را یک بار بسازید:

```bash
docker network inspect eduspace-edge >/dev/null 2>&1 || docker network create eduspace-edge
```

بدون چاپ secretها Compose را اعتبارسنجی کنید:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml config --quiet
```

خروجی کامل `docker compose config` را منتشر نکنید؛ env حل‌شده می‌تواند secret داشته باشد.

## Reverse proxy موجود

برای Nginx میزبان، دو server block مجزای HTTPS لازم است:

```nginx
# دامنهٔ برنامه
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

# دامنهٔ RTC
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

```bash
sudo nginx -t
sudo systemctl reload nginx
```

اگر proxy داخل Docker است، آن را به `eduspace-edge` متصل کنید و مقصدهای `eduspace-production-web:80` و `eduspace-production-rtc:7880` را استفاده کنید.

## اولین اجرا و همهٔ آپدیت‌های معمول

فقط این دستور لازم است:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml up -d --pull always --wait
```

Compose به ترتیب:

1. imageهای تأییدشده را از GHCR pull می‌کند.
2. PostgreSQL و Redis و دسترسی volumeها را آماده می‌کند.
3. migration را در کانتینر one-shot اجرا می‌کند.
4. collectstatic را در کانتینر one-shot اجرا می‌کند.
5. backend را پس از موفقیت مراحل قبل بالا می‌آورد.
6. web، worker، Beat، LiveKit، Egress و Gotenberg را اجرا می‌کند.

اگر migration یا collectstatic شکست بخورد، backend جدید شروع نمی‌شود. خطا را بررسی کنید و برای رفع آن volume حذف نکنید.

برای آپدیت معمول برنامه `git pull` لازم نیست. فقط وقتی فایل‌های Compose یا زیرساخت تغییر کرده‌اند، ابتدا commit تأییدشدهٔ زیرساخت را checkout کنید و سپس همین دستور را اجرا کنید.

این روش migration ناسازگار را بدون قطعی امن نمی‌کند. migrationهای معمول باید backward-compatible باشند. تغییرات شکستن schema به maintenance window، backup تأییدشده و برنامهٔ recovery نیاز دارند.

مدیر اولیه فقط بار اول ساخته می‌شود:

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec backend python manage.py createsuperuser
```

## وضعیت و log

```bash
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml ps --all
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml logs --tail=200 backend worker livekit egress
docker compose --env-file .deploy/production.env -p eduspace-production -f compose.server.yml exec -T worker celery -A config inspect ping --timeout=10
```

بعد از هر نسخه ورود، context سازمان، تماس دو دستگاه روی دو اینترنت، میکروفون، دوربین، اشتراک صفحه، تبدیل سند، ضبط و عدم دسترسی بدون مجوز به ضبط را تست کنید. پاسخ HTTPS و اتصال signaling به‌تنهایی پورت رسانه را اثبات نمی‌کند.

## Rollback

tag تغییرناپذیر نسخهٔ قبلی را در env بگذارید:

```dotenv
RELEASE_TAG=sha-0123456789ab
```

سپس دستور معمول Compose را اجرا کنید. backend و web با هم به یک commit برمی‌گردند. این کار migration دیتابیس را برنمی‌گرداند؛ سازگاری schema باید جداگانه بررسی شود. برای دنبال‌کردن نسخه‌های جدید دوباره `RELEASE_TAG=production` بگذارید.

## Backup و مرز ایمنی

Pull کردن image از داده‌ها backup نمی‌گیرد. پیش از نسخه‌های دارای migration، در maintenance window از دیتابیس و فایل‌ها backup بگیرید، صحت آن را بررسی و نسخه‌ای رمزگذاری‌شده خارج از سرور نگه دارید.

برای عیب‌یابی این دستورها را اجرا نکنید:

```text
docker compose down -v
docker volume prune
git clean -fdx
حذف پوشهٔ .deploy
```

این کارها می‌توانند داده یا کلیدهای production را نابود کنند.

اگر پروژه باید خودش پورت‌های ۸۰/۴۴۳ را در اختیار بگیرد، `compose.edge.yml` سرویس Caddy را فراهم می‌کند. وقتی Nginx یا سایت دیگری این پورت‌ها را دارد، Caddy پروژه را اجرا نکنید.
