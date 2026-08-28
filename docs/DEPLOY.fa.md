# اجرای EduSpace روی سرور لینوکس — بدون CI/CD

## نسخهٔ کوتاه برای مدیر سرور

فقط دسترسی مخزن GitHub، Docker Engine با Compose نسخهٔ ۲.۲۴ یا بالاتر، Git، Python 3.9+ و دو زیردامنه لازم است. Python فقط کتابخانهٔ استاندارد می‌خواهد؛ نیازی به نصب Django، Node، npm یا pip روی میزبان نیست. ساخت برنامه داخل Docker روی خود سرور انجام می‌شود.

ابتدا یک **staging** راه می‌اندازیم؛ این دستورها production را اجرا نمی‌کنند.

۱. دو رکورد DNS نوع A بسازید که مستقیم به IPv4 عمومی سرور اشاره کنند:

```text
staging.YOUR-DOMAIN       -> SERVER_PUBLIC_IP
rtc-staging.YOUR-DOMAIN   -> SERVER_PUBLIC_IP
```

این دو رکورد در حالت DNS-only باشند. AAAA اشتباه را حذف کنید. سرور باید از اینترنت به GitHub، Docker Hub، PyPI، npm و مخازن Debian دسترسی داشته باشد.

۲. اگر 80 و 443 آزاد است، دستورهای زیر را اجرا کنید. موارد داخل <> را جایگزین کنید:

```bash
git clone --branch develop --single-branch <GITHUB_REPOSITORY_URL> eduspace
cd eduspace
bash scripts/server.sh init staging
bash scripts/server.sh check staging
bash scripts/server.sh deploy staging
bash scripts/server.sh admin staging
```

`init` فقط نام دو دامنه و IPv4 عمومی سرور را می‌پرسد؛ رمزها را خودش می‌سازد. `admin` حساب مدیر Django می‌سازد و رمز را تعاملی می‌گیرد. بعد سایت را در `https://staging.YOUR-DOMAIN` باز کنید.

**اگر روی سرور Nginx یا وب‌سایت دیگری هست، به‌جای init بالا این را اجرا کنید و بخش «وب‌سرور موجود» را بخوانید:**

```bash
bash scripts/server.sh init staging --edge external
```

هیچ اسکریپتی Docker نصب نمی‌کند، تنظیمات فایروال را عوض نمی‌کند، سایت‌های قبلی را متوقف نمی‌کند و از `sudo` استفاده نمی‌کند. کاربر اجراکننده باید اجازهٔ استفاده از Docker داشته باشد؛ این دسترسی از نظر امنیتی قدرتمند و در حد مدیریت میزبان است.

## چه چیزهایی باید به مدیر سرور تحویل بدهیم؟

- دسترسی فقط‌خواندنی مخزن و نام commit/branch موردنظر؛ این تغییرات باید ابتدا در GitHub منتشر شده باشند.
- نام دو زیردامنه و دسترسی تنظیم DNS، یا رکوردهایی که خودمان تنظیم کرده‌ایم.
- همین راهنما. فایل env لوکال، venv، node_modules، دیتابیس و media شخصی را ارسال نکنید.
- اطلاع از اینکه پورت 80/443 در اختیار پروژه است یا از reverse proxy موجود استفاده می‌شود.

برای مخزن خصوصی، deploy key فقط‌خواندنی مناسب است. رمز GitHub یا کلید SSH خصوصی را داخل env پروژه ننویسید.

## پورت‌های فایروال

هم در فایروال سیستم‌عامل و هم پنل ارائه‌دهندهٔ سرور بررسی شوند. SSH فعلی را نبندید.

| کاربرد | Staging | Production |
|---|---|---|
| HTTPS و دریافت گواهی | TCP 80 و 443 مشترک | همان ورودی مشترک |
| رسانهٔ LiveKit روی TCP | TCP 7881 | TCP 7891 |
| رسانهٔ LiveKit روی UDP | UDP 7882 | UDP 7892 |
| TURN روی UDP | UDP 3478 | UDP 3479 |
| وب برای reverse proxy روی میزبان | فقط `127.0.0.1:8080` | فقط `127.0.0.1:8081` |
| سیگنالینگ LiveKit برای reverse proxy | فقط `127.0.0.1:7880` | فقط `127.0.0.1:7890` |

PostgreSQL، Redis، Gotenberg و API بک‌اند پورت عمومی ندارند. پورت‌های داخل env با پورت‌های فایروال و NAT باید یکسان باشند. در این نسخه از UDP mux استفاده می‌شود؛ بازکردن بازهٔ 50000 تا 60000 لازم نیست.

**محدودیت تماس:** TURN/UDP فعال است، اما TURN/TLS روی 443 در این بسته تنظیم نشده است. شبکه‌هایی که UDP و TCP رسانه را می‌بندند ممکن است نتوانند تماس برقرار کنند. پیش از استفادهٔ واقعی، تماس را با اینترنت موبایل، اینترنت ثابت و VPN آزمایش کنید. اگر TURN/TLS لازم باشد، برای جلوگیری از تداخل با HTTPS به ورودی لایهٔ چهار یا IP جدا نیاز است؛ صرف ساختن زیردامنه کافی نیست.

مرجع: [پورت‌های LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## فایل تنظیمات کجاست؟

بعد از init:

```text
.deploy/staging.env
.deploy/production.env       # فقط اگر production را init کرده باشید
```

این فایل‌ها داخل Git و image قرار نمی‌گیرند و روی لینوکس با دسترسی 600 ساخته می‌شوند. کل پوشهٔ `.deploy` محلی و محرمانه است؛ آن را هنگام تعویض checkout یا جابه‌جایی سرور حفظ کنید. دستورهای پاک‌سازی مثل `git clean -fdx` می‌توانند تنظیمات و backupهای ignored را حذف کنند؛ اجرا نکنید.

نمونهٔ کامل و بدون secret در `infra/server/.env.example` است. فرمت فایل: هر خط `KEY=value`، بدون دستور shell، `$`، backtick یا کامنت انتهای خط. رمزهای اصلی تولیدشده را تغییر ندهید.

| متغیر | توضیح |
|---|---|
| `DEPLOY_ENV` | staging یا production؛ با آرگومان دستور باید یکی باشد |
| `APP_DOMAIN`, `RTC_DOMAIN` | فقط hostname؛ بدون https، مسیر یا پورت |
| `PUBLIC_IP` | IPv4 عمومی که مرورگر به آن دسترسی دارد |
| `EDGE_MODE` | caddy برای HTTPS خودکار؛ external برای وب‌سرور موجود |
| `WEB_PORT`, `RTC_HTTP_PORT` | پورت‌های خصوصی روی loopback میزبان |
| `RTC_TCP_PORT`, `RTC_UDP_PORT`, `TURN_UDP_PORT` | پورت‌های عمومی رسانه |
| `SECRET_KEY` | کلید امضای Django، تولید خودکار و مستقل |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | مشخصات دیتابیس همان محیط |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | تولید خودکار و هماهنگ بین سرویس‌های RTC |
| `LIVEKIT_IMAGE`, `EGRESS_IMAGE` | نسخهٔ مشخص imageها؛ از latest استفاده نکنید |
| `RECORDING_DEFAULT_QUALITY`, `RECORDING_MAX_DURATION_SECONDS` | کیفیت پیش‌فرض و سقف زمان ضبط |
| `PRESENTATION_MAX_UPLOAD_BYTES`, `PRESENTATION_MAX_OUTPUT_BYTES` | سقف حجم ورودی و خروجی اسناد |
| `PRESENTATION_MAX_PAGES`, `PRESENTATION_MAX_IMAGE_PIXELS`, `PRESENTATION_CONVERSION_TIMEOUT_SECONDS` | محدودیت تبدیل اسناد |

Compose این مقادیر را خودش تنظیم می‌کند؛ لازم نیست مدیر سرور آن‌ها را وارد کند:

```text
DJANGO_SETTINGS_MODULE=config.server_settings
DEBUG=False
USE_SQLITE=False
DB_HOST=db
DB_PORT=5432
REDIS_HOST=redis
GOTENBERG_URL=http://gotenberg:3000
LIVEKIT_HOST_URL=http://livekit:7880
LIVEKIT_WS_URL=wss://<RTC_DOMAIN>
RECORDING_OUTPUT_DIR=media/recordings
```

داخل کانتینر، localhost یعنی همان کانتینر؛ برای ارتباط بین سرویس‌ها نام سرویس استفاده می‌شود. ALLOWED_HOSTS، CORS و CSRF به دامنهٔ همان محیط محدود می‌شوند. فرانت‌اند API و WebSocket را از دامنهٔ مرورگر می‌سازد؛ `VITE_API_URL` یا env لوکال را روی سرور کپی نکنید.

### اتصال‌های اختیاری

- خطایابی: `SENTRY_DSN` برای بک‌اند. Sentry فرانت‌اند در build سرور فعلاً خاموش است.
- فضای S3 برای مسیر ضبط موجود: `S3_ENABLED`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `CDN_URL`. برای شروع خاموش نگه دارید. فعال‌کردن آن همهٔ فایل‌های پروژه را خودکار جابه‌جا نمی‌کند. انتشار فایل ضبط از CDN نیازمند بررسی سیاست دسترسی است.
- SMTP: `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`.
- پیامک: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- پرداخت: `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

Staging عمداً ایمیل را به log می‌فرستد و اعتبارنامه‌های Twilio/Stripe را غیرفعال می‌کند. log ممکن است اطلاعات آزمایشی داشته باشد، آن را عمومی نکنید. بعضی taskهای قدیمی ارسال پیام در خود برنامه هنوز placeholder هستند؛ استقرار آن‌ها را به سرویس واقعی تبدیل نمی‌کند.

**تغییر DB_PASSWORD در env رمز دیتابیس موجود را تغییر نمی‌دهد.** اسکریپت جلوی این تغییر اشتباه را می‌گیرد. چرخش اعتبارنامه نیازمند تغییر هماهنگ داخل PostgreSQL است. init دوباره، فایل و رمزهای قبلی را بازنویسی نمی‌کند.

## وب‌سرور موجود: Nginx روی میزبان

در حالت external، پروژه پورت 80 یا 443 را اشغال نمی‌کند. مدیر سرور باید گواهی معتبر برای هر دو دامنه و هدایت HTTP به HTTPS را در تنظیمات موجود خود اضافه کند. فایل نمونه را بدون بررسی روی تنظیمات فعلی overwrite نکنید.

نمونهٔ بلوک‌های داخل serverهای HTTPS موجود برای staging:

```nginx
# داخل server مربوط به staging.YOUR-DOMAIN با listen 443 ssl
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    client_max_body_size 110m;
}

# داخل server جدا برای rtc-staging.YOUR-DOMAIN با listen 443 ssl
location / {
    proxy_pass http://127.0.0.1:7880;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

اگر reverse proxy خودش داخل Docker است، `127.0.0.1` آن به میزبان اشاره نمی‌کند. آن را با تصمیم مدیر سرور به شبکهٔ `eduspace-edge` متصل کنید و مقصدها را `eduspace-staging-web:80` و `eduspace-staging-rtc:7880` بگذارید. برای production نام aliasها و پورت‌های جدول را تغییر دهید.

در حالت caddy، یک ورودی مشترک برای staging و production ساخته می‌شود؛ Caddy گواهی‌ها را خودکار می‌گیرد و در volume ماندگار نگه می‌دارد. هر دو محیط را از **همان checkout** مدیریت کنید. تغییر EDGE_MODE بعد از راه‌اندازی نیازمند جمع‌کردن مسیر قبلی توسط مدیر سرور است؛ اسکریپت سرویس مشترک را خودسرانه متوقف نمی‌کند.

## بعد از اجرای اولیه چه چیزی تست شود؟

اسکریپت build، migration، collectstatic، سلامت DB/Redis/API و پاسخ HTTPS را بررسی می‌کند. این جایگزین تست کاربردی نیست:

- ورود و ساخت سازمان/کلاس با حساب‌های آزمایشی؛ seedهای قدیمی دادهٔ نمونه خودکار اجرا نمی‌شوند.
- اتصال دو کاربر از دو اینترنت متفاوت، میکروفون، دوربین و اشتراک صفحه.
- آپلود PDF و فایل Office و انتظار برای تبدیل توسط worker.
- شروع/توقف ضبط و پخش آن بعد از آماده‌شدن.
- رد درخواست فایل ضبط بدون ورود؛ مسیر مستقیم `/media/recordings/` عمداً بسته است.
- اعلان و بازی‌ها؛ برای ثبت بازی Classroom در کاتالوگ، در صورت نیاز از دستور مدیریت `seed_classroom_game` استفاده کنید.
- ماندگاری داده پس از restart سرور و بازگشت سرویس‌ها با restart policy.

توجه: migrationهای قدیمی خود پروژه یک `Default Academy` و در دیتابیس خالی یک مالک سیستمی `system_admin` بدون رمز ورود قابل‌استفاده می‌سازند. این حساب، حساب مدیر شما نیست. دستور admin مدیر شخصی شما را می‌سازد؛ سازمان و عضویت‌ها را از برنامه یا پنل مدیریت تنظیم کنید. seedهای قدیمی کاربران و کلاس‌های نمایشی اجرا نمی‌شوند.

Egress برای ضبط ترکیبی منابع قابل‌توجه مصرف می‌کند. مستندات LiveKit برای هر Egress حداقل ۴ CPU و ۴GB RAM پیشنهاد می‌کند؛ کل پروژه و build به منابع اضافه نیاز دارند. ظرفیت کلاس‌ها بدون اندازه‌گیری روی سرور مشخص نیست. [نیازمندی Egress](https://docs.livekit.io/transport/self-hosting/egress/)

## انتشار نسخهٔ بعدی

در زمان بدون کلاس و ضبط فعال:

```bash
git pull --ff-only
bash scripts/server.sh deploy staging --allow-interruption
```

اسکریپت خودش git pull، push، تغییر branch یا انتشار خودکار انجام نمی‌دهد. اول build جدید تکمیل می‌شود؛ سپس نویسندگان داده متوقف می‌شوند، backup گرفته می‌شود، migration اجرا و سرویس‌ها شروع می‌شوند. شکست هر مرحله مانع ادامه می‌شود. اگر بعد از توقف خطا رخ دهد، ممکن است محیط متوقف بماند؛ علت را رفع و دستور deploy را دوباره اجرا کنید. حذف volume راه‌حل خطای migration نیست.

این استقرار بدون قطعی نیست؛ `--allow-interruption` تأیید قطع کلاس‌ها و ضبط‌های فعال است.

## Production، فقط بعد از تست

پوش روی `develop` فقط کد را به GitHub می‌فرستد؛ هیچ محیطی خودکار منتشر نمی‌شود. برای production نیز CI/CD لازم نیست و دستور صریح deploy تعیین می‌کند کدام محیط تغییر کند.

پس از تست staging، با دستور زیر مقدار `commit` نسخهٔ اجراشده را بردارید:

```bash
bash scripts/server.sh status staging
```

همان commit تأییدشده را checkout کنید؛ صرف هم‌نام بودن branch تضمین نسخه نیست. دو دامنهٔ جدید، مثلاً `app.YOUR-DOMAIN` و `rtc.YOUR-DOMAIN`، به همان IP متصل کنید و پورت‌های production جدول بالا را باز کنید. روی همان checkout، `<TESTED_COMMIT>` را با commit ثبت‌شدهٔ staging جایگزین کنید:

```bash
git fetch origin develop
git checkout --detach <TESTED_COMMIT>
bash scripts/server.sh init production --confirm-production
bash scripts/server.sh check production
bash scripts/server.sh deploy production --confirm-production
bash scripts/server.sh admin production --confirm-production
```

اگر از وب‌سرور موجود استفاده می‌کنید در init گزینهٔ `--edge external` را اضافه کنید. برای به‌روزرسانی production علاوه بر تأیید بالا، `--allow-interruption` هم لازم است.

دستورهای init و admin برای راه‌اندازی اولیه‌اند، نه هر به‌روزرسانی. بعداً برای دریافت نسخهٔ توسعهٔ جدید، از `git switch develop` و `git pull --ff-only` استفاده کنید و دوباره ابتدا staging را تست کنید. جابه‌جایی Git به‌تنهایی کانتینرهای در حال اجرا را تغییر نمی‌دهد؛ آن‌ها image مستقل دارند.

دیتابیس، Redis، فایل‌ها، کلیدها و پورت‌های رسانه مستقل هستند؛ دیتابیس staging به production منتقل نمی‌شود. توسعهٔ لوکال همچنان با Compose قبلی و `backend/.env` انجام می‌شود. `config.server_settings` فقط در کانتینرهای سرور استفاده می‌شود.

هر build شمارهٔ commit و شناسهٔ image مستقل دارد. این روش بدون registry دوباره روی سرور build می‌کند؛ به‌دلیل وابستگی‌های دارای بازهٔ نسخه، تضمین بازتولید بایت‌به‌بایت نمی‌دهد. قبل از استفادهٔ حساس، نسخهٔ ساخته‌شده را مجدداً تست کنید. هر دو محیط منابع یک میزبان را مصرف می‌کنند؛ این جداسازی معادل دو سرور مستقل نیست.

## وضعیت، log و backup

```bash
bash scripts/server.sh status staging
bash scripts/server.sh logs staging --service backend
bash scripts/server.sh logs staging --service worker
bash scripts/server.sh logs staging --service livekit
bash scripts/server.sh logs staging --service egress
bash scripts/server.sh backup staging --allow-interruption
```

برای production نام محیط را عوض کنید و برای backup گزینهٔ `--confirm-production` بدهید. backup standalone سرویس‌های قبلاً فعال را در پایان دوباره راه می‌اندازد.

Backup در `.deploy/<environment>/backups/<UTC timestamp>/` شامل dump دیتابیس، archive فایل‌های عمومی و خصوصی و ضبط‌ها، env محرمانه و مشخصات release است. فقط backup دارای فایل `COMPLETE` کامل است. حین backup نویسندگان برنامه متوقف‌اند؛ هیچ ابزار دیگری نباید به دیتابیس یا volumeها بنویسد.

نسخه‌ای از backup را **رمزگذاری‌شده خارج از همان سرور** نگه دارید. backup محلی از خرابی دیسک محافظت نمی‌کند. زمان‌بندی خودکار backup در این نسخه نصب نمی‌شود؛ مدیر سرور باید برنامهٔ عملیاتی آن را تعیین کند.

### بازگشت نسخه و بازیابی

بازگرداندن کد لزوماً migration را برنمی‌گرداند. اسکریپت عمداً دستور خودکار و مخرب rollback/restore ندارد. قبل از migration ناسازگار، این فرآیند را روی یک محیط مجزای آزمایشی تمرین کنید:

۱. backup کامل و commit/image متناظر را پیدا کنید؛ هدف بازیابی را دقیق مشخص کنید.
۲. نویسندگان دادهٔ محیط هدف را متوقف و از وضعیت فعلی نیز backup بگیرید.
۳. PostgreSQL را با `pg_restore` و dump انتخاب‌شده به دیتابیس هدف بازیابی کنید.
۴. `files.tar.gz` را به volumeهای media/recordings/private همان محیط برگردانید؛ نگاشت مسیرها در Compose مشخص است. مالکیت Backend برابر UID 10001 و گروه مشترک Egress برابر GID 2000 است.
۵. env و نسخهٔ برنامهٔ سازگار با آن backup را فعال کنید. صف‌های قدیمی Redis را بدون بررسی دوباره به کار نیندازید؛ ممکن است به دادهٔ پس از backup اشاره کنند.
۶. سلامت، ورود، فایل‌ها و ضبط را تست کنید، سپس دسترسی کاربران را باز کنید.

بازیابی به نقطهٔ گذشته می‌تواند داده‌های بعد از backup را از دست بدهد و باید با تأیید مالک داده انجام شود. از `docker compose down -v`، prune volume یا حذف پوشهٔ `.deploy` برای رفع خطا استفاده نکنید.

## عیب‌یابی سریع

| علامت | بررسی |
|---|---|
| خطای bind پورت 80/443 | وب‌سرور موجود دارید؛ از external استفاده کنید |
| HTTPS آماده نیست | DNS، AAAA، فایروال 80/443 و log ورودی Caddy |
| سایت باز می‌شود، صدا/تصویر ندارد | PUBLIC_IP، پورت UDP/TCP و محدودیت شبکه/TURN |
| تبدیل Office معطل است | worker، صف documents و سلامت Gotenberg |
| ضبط شکست می‌خورد | log Egress، منابع CPU/RAM، مجوز SYS_ADMIN و گروه volume |
| خطای رمز PostgreSQL بعد از ویرایش env | رمز volume موجود با env تغییر نمی‌کند؛ env قبلی را برگردانید |
| build خطای دانلود دارد | دسترسی سرور به registry/PyPI/npm/Debian را بررسی کنید |

دستور `check` فایروال و مسیر واقعی WebRTC را از بیرون سرور اثبات نمی‌کند. نصب کامل باید با تست واقعی روی دامنه و اینترنت کاربران تأیید شود.
