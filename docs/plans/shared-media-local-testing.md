# راهنمای تست محلی سینمای آنلاین

## پیش‌نیازها

- Docker Desktop روشن باشد.
- Backend روی host از `backend/.env` استفاده کند. مقادیر نمونه S3/MinIO در `backend/.env.example` ثبت شده‌اند.
- MinIO این Compose فقط برای توسعه محلی است و روی `127.0.0.1:9000` منتشر می‌شود؛ image عمومی Community archived است و نباید برای production استفاده شود.

## راه‌اندازی dependencyها

```powershell
docker compose up -d db redis minio minio-init media-worker media-ingest-worker
cd backend
venv\Scripts\python.exe manage.py migrate --noinput
venv\Scripts\python.exe manage.py runserver
```

در terminal دیگر:

```powershell
cd frontend
npm run dev
```

MinIO Console برای مشاهده محلی objectها روی `http://127.0.0.1:9001` است. credential پیش‌فرض توسعه در `.env.example` قرار دارد.

## سناریوی پذیرش دستی

1. با حساب میزبان یا هم‌میزبان وارد Room شوید.
2. از Tools گزینه «سینمای آنلاین» را باز کنید.
3. یک MP4/WebM/MOV/MKV کوتاه انتخاب کنید.
4. درصد upload باید پیش برود و وضعیت asset به‌ترتیب از upload به inspection/processing و سپس «آماده پخش» برسد.
5. «شروع» را بزنید و همان Room را در مرورگر/پروفایل دوم باز کنید.
6. Play/Pause و پرش ±۱۰ ثانیه را امتحان کنید؛ viewer دوم باید snapshot مرجع را بازیابی و drift را اصلاح کند.
7. «پایان پخش برای همه» را بزنید. در Room دیگری همان asset را دوباره شروع کنید؛ playback باید از checkpoint آخر ادامه پیدا کند.
8. پس از پایان playback، حذف دستی asset باید موفق باشد. حذف حین playback باز باید توسط Backend رد شود.

## سناریوی تست سینک سه‌کاربره

1. Room را در سه browser profile یا سه دستگاه باز کنید و در هر سه صفحه hard refresh انجام دهید.
2. میزبان یک فایل سازگار با progressive upload را انتخاب کند و به‌محض فعال‌شدن «شروع»، پخش را آغاز کند.
3. badge بالای player باید ابتدا تعداد گزارش‌دهندگان را جمع کند و سپس «همگام X از ۳» نشان دهد.
4. badge را باز کنید؛ برای هر کاربر `drift`، بافر آماده، کیفیت و وضعیت ready/buffering/recovering/error نمایش داده می‌شود.
5. نزدیک frontier آپلود، هر سه کاربر باید با وضعیت BUFFERING مشترک متوقف شوند و پس از ایجاد ۱۰ ثانیه حاشیه امن از یک anchor مشترک ادامه دهند.
6. شبکه یکی از viewerها را موقتاً throttle یا offline کنید. وضعیت او باید ابتدا recovering شود؛ پس از اتصال، بدون retry دستی به زمان canonical برگردد. فقط پس از سه شکست خودکار retry دستی مجاز است.
7. نتیجه قابل قبول پایلوت: کاربران سالم عمدتاً drift کمتر از یک ثانیه داشته باشند؛ کندی یک viewer نباید timeline بقیه را برای همیشه متوقف کند.

### مقایسه دو سیاست

- در «پخش پیوسته»، شبکه یکی از viewerها را مختل کنید؛ همان viewer باید recovery کند ولی کاربران سالم ادامه دهند. توقف مشترک ناشی از frontier آپلود همچنان مجاز است.
- در «سینک سخت‌گیرانه»، اختلال را بیش از ۵ ثانیه نگه دارید؛ کل گروه باید با پیام «در انتظار همگام‌شدن شرکت‌کنندگان» متوقف شود. پس از بازگشت سلامت همه کاربران در اتاق سه‌نفره و پایداری ۳ ثانیه‌ای، پخش باید خودکار ادامه پیدا کند.
- در اتاق‌های حداکثر ۵ نفر همه باید آماده باشند؛ برای اتاق‌های بزرگ‌تر quorum فعلی ۹۰٪ است تا یک کاربر قطع‌شده جلسه را برای همیشه قفل نکند.
- هنگام BUFFERING سخت‌گیرانه، تغییر policy به «پخش پیوسته» باید پخش را از همان anchor مشترک آزاد کند.

گزارش سلامت هر دو ثانیه فقط به moderatorهای حاضر و با DataChannel غیرقابل‌اعتماد ارسال می‌شود، در دیتابیس ذخیره نمی‌شود و پس از ۷ ثانیه بدون گزارش از داشبورد حذف می‌گردد.

برای آزمون resume، upload را وسط کار با refresh قطع کنید و همان فایل را دوباره انتخاب کنید. UI شناسه session را از draft محلی می‌خواند و Backend با `ListParts` فقط partهای باقی‌مانده را ارسال می‌کند.

## تست runtime واقعی

این تست در suite عادی skip می‌شود و فقط در image دارای FFmpeg و MinIO اجرا می‌شود:

```powershell
docker compose build media-worker
docker compose run --rm -e RUN_MEDIA_RUNTIME_TESTS=1 media-worker python manage.py test tests.media_library.test_runtime_pipeline --noinput -v 2
```

تست اول MP4 واقعی H.264/AAC تولید و مسیر `ffprobe → inspection → FFmpeg HLS/CMAF → private S3` را بررسی می‌کند. تست دوم preflight مرورگر، PUT امضاشده و expose شدن `ETag` را کنترل می‌کند.

## عیب‌یابی سریع

```powershell
docker compose ps
docker compose logs --tail 100 media-worker
docker compose logs --tail 100 media-ingest-worker
docker compose logs --tail 100 minio-init
```

- `STORAGE_NOT_CONFIGURED`: Backend روی host مقادیر S3 فایل `.env` را نخوانده است.
- upload بدون `ETag`: origin فرانت‌اند باید دقیقاً `localhost:5173` یا `127.0.0.1:5173` باشد.
- asset در `processing` مانده: سلامت worker و اتصال Redis را در log بررسی کنید.
- خطای ffprobe/ffmpeg روی host: پردازش باید توسط `media-worker` Docker انجام شود، نه worker ویندوزی بدون FFmpeg.
