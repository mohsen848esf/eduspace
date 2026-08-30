# نقشه راه پیاده‌سازی سینمای آنلاین و کتابخانه مدیا در EduSpace

وضعیت: Foundation، pipeline امن HLS و برش اول Shared Player MVP تکمیل؛ اصلاحات تست میدانی اضافه شد
شاخه: `feat/shared-media-cinema-foundation`
تاریخ: ۲۰۲۶-۰۸-۲۹

## نتیجه تصمیم

قابلیت به‌صورت دو زیردامنه مستقل ساخته می‌شود:

1. **کتابخانه مدیای مستقل از سازمان**: فایل ویدئو فعلاً متعلق به حساب uploader/owner در سامانه تماس است، به اتاق یا جلسه خاص وابسته نیست، تاریخ انقضا ندارد و فقط با اقدام صریح مالک حذف می‌شود. در آینده می‌توان `MediaLibrary ACL` تیمی اضافه کرد، بدون اینکه سرویس تماس Organization را بشناسد.
2. **جلسه پخش مشترک**: هر بار استفاده از یک مدیا در یک اتاق، یک `SharedPlaybackSession` مستقل با موقعیت مرجع، نسخه فرمان و تاریخچه ایجاد می‌کند. جلسه بعد می‌تواند از checkpoint جلسه قبلی ادامه دهد.

ویدئو از LiveKit عبور نمی‌کند. هر بیننده HLS/CMAF را مستقیماً از CDN دریافت می‌کند و LiveKit فقط control-plane سبک شامل Play/Pause/Seek، نسخه، زمان اجرای مرجع و اعلان invalidation را حمل می‌کند. مرجع نهایی وضعیت، Backend/Database و snapshotهای Redis است.

## نیازهای محصول تثبیت‌شده

- برگزارکننده می‌تواند ویدئو را یک بار آپلود و در چند اتاق یا جلسه استفاده کند.
- مدیا پس از پایان جلسه پاک نمی‌شود و در کتابخانه مالک باقی می‌ماند.
- حذف فقط دستی، قابل تأیید و قابل ممیزی است؛ حذف هنگام پخش فعال مجاز نیست.
- تاریخچه استفاده، آخرین checkpoint گروهی و جلسه مبدأ نگهداری می‌شود.
- در جلسه بعد، میزبان میان «ادامه از آخرین checkpoint» و «شروع از ابتدا/زمان دلخواه» انتخاب می‌کند.
- کنترل پخش با میزبان و هم‌میزبان است؛ کاربران عادی فقط کنترل صدای محلی، زیرنویس و کیفیت خود را دارند.
- کیفیت هر بیننده مستقل و تطبیقی است، اما timeline مشترک باقی می‌ماند.
- UI سه مفهوم را جدا نشان می‌دهد: پیشرفت آپلود، پیشرفت پردازش، و مدت واقعاً قابل پخش.
- هیچ وعده عمومی بر مبنای «درصد فایل» یا «بدون لگ» داده نمی‌شود.

## مدل همگام‌سازی پیشنهادی

### زمان مرجع

هر وضعیت authoritative شامل این فیلدهاست:

```text
playback_id, asset_id, version, state,
anchor_position_ms, effective_at_server,
playback_rate, published_duration_ms
```

موقعیت مورد انتظار در حالت Playing:

```text
expected = anchor_position_ms
         + (server_now - effective_at_server) * playback_rate
```

### پروتکل شروع

1. میزبان asset و checkpoint را انتخاب می‌کند.
2. کلاینت‌ها manifest و چند ثانیه buffer را preload می‌کنند.
3. کلاینت‌ها `READY | AT_RISK | BUFFERING` گزارش می‌دهند.
4. میزبان درصد آمادگی را می‌بیند.
5. فرمان Play با `effective_at` حدود ۱٫۵ تا ۲٫۵ ثانیه در آینده منتشر می‌شود.
6. کلاینت آماده در همان زمان شروع می‌کند؛ کلاینت دیررس به timeline جاری می‌پیوندد.

### اصلاح drift

- کمتر از ۲۵۰ms: بدون اصلاح.
- ۲۵۰ تا ۱۰۰۰ms: اصلاح نرم و کوتاه با نرخ حدود ۰٫۹۷ تا ۱٫۰۳.
- بیشتر از ۱۰۰۰ms، پس از reconnect یا تغییر asset: hard seek به موقعیت مرجع.
- seek هرگز از `published_duration - safety_guard` جلوتر نمی‌رود.
- snapshot مرجع هنگام join/rejoin، تغییر visibility و به‌صورت fallback دوره‌ای بازیابی می‌شود؛ packet به‌تنهایی authority امنیتی نیست.

این آستانه‌ها مقدار اولیه‌اند و باید با تست واقعی شبکه و UX تنظیم شوند.

## معیار اصلی همگامی

`Synced Viewer Ratio` درصد بینندگان فعال و آماده‌ای است که قدر مطلق drift آن‌ها حداکثر ۵۰۰ms باشد.

هدف Pilot:

- p50 نسبت کاربران sync‌شده: حداقل ۹۷٪
- p95 نسبت کاربران sync‌شده: حداقل ۹۵٪
- p95 drift کاربران Ready: کمتر از ۵۰۰ms
- بازیابی p95 پس از reconnect: کمتر از ۳ ثانیه
- rebuffer ratio: کمتر از ۱٪ viewer-time روی شبکه‌های واجد شرایط

## فازبندی اجرایی

## مرز استخراج سرویس تماس

- سرویس تماس فقط `User subject`، `Room`، `RoomParticipant`، `MediaAsset` و `SharedPlaybackSession` را می‌شناسد؛ Organization/Course/Class/Session جزو قرارداد آن نیستند.
- در monolith فعلی، User FK نقش subject را دارد. پس از استخراج، EduSpace از OIDC/JWT یک `sub` پایدار به Call Service می‌دهد و کاربر محلی سرویس با آن resolve می‌شود.
- `MediaAsset` مالک مستقل دارد و طول عمرش از Room بیشتر است؛ `SharedPlaybackSession` متعلق به Room است و فقط تاریخچه استفاده از asset را نگه می‌دارد.
- participant کتابخانه میزبان را browse نمی‌کند. Call Service پس از احراز عضویت فعال در Room، دسترسی کوتاه‌عمر و room-scoped به manifest/CDN صادر می‌کند.
- کتابخانه تیمی آینده با `MediaLibrary + LibraryMembership/ACL` مدل می‌شود. اتصال اختیاری یک سازمان EduSpace به library در integration layer می‌ماند، نه در دامنه تماس.
- نتیجه استخراج آینده: انتقال مدل‌های call/media و جایگزینی User FK با subject mapping؛ migration برای حذف Organization یا بازنویسی پروتکل sync لازم نیست.

### فاز صفر — Foundation و قرارداد دامنه (تکمیل‌شده)

خروجی عمودی:

- اپ مستقل Backend به نام `media_library`؛
- `MediaAsset` متعلق به حساب مستقل با نگهداری دستی؛
- `MediaRendition` برای نسخه‌های HLS و مرز قابل پخش؛
- `SharedPlaybackSession` برای history، checkpoint و optimistic version؛
- service layer اتمیک برای ایجاد، ادامه، فرمان و حذف دستی؛
- migration، admin و تست قواعد tenant/lifecycle؛
- ADR/Graphify به‌روزشده.

معیار پذیرش:

- یک asset مالک در چند اتاق قابل استفاده باشد.
- asset بین جلسات باقی بماند.
- continuation از checkpoint قبلی ایجاد شود.
- asset متعلق به حساب نامرتبط قابل اتصال نباشد.
- فرمان stale نتواند وضعیت جدید را overwrite کند.
- حذف دستی هنگام پخش فعال رد شود.

وضعیت پیاده‌سازی در همین شاخه:

- مدل‌ها، migration، admin و service layer اتمیک اضافه شده‌اند.
- API مالک‌محور list/detail/create-metadata/delete/history پیاده شده و به header سازمان وابسته نیست.
- API اتاق برای open/command/snapshot اضافه شده؛ snapshot همراه `server_now` و `Cache-Control: no-store` مرجع نهایی کلاینت است.
- فرمان‌ها optimistic version دارند و فرمان stale با `409 STALE_PLAYBACK_VERSION` رد می‌شود.
- کلاینت `effective_at` ارسال نمی‌کند؛ فقط `lead_time_ms` محدود می‌فرستد و سرور زمان اجرای PLAY را تعیین می‌کند.
- قرارداد Zod، API client، query keys، Zustand store مقاوم در برابر پاسخ دیررس و packet نسخه‌دار invalidation در فرانت‌اند اضافه شده است.
- direct multipart upload برای S3/MinIO شامل initiate، امضای هر part، بازیابی `ListParts` پس از refresh و complete اضافه شده است؛ باینری از Django عبور نمی‌کند. orchestration مرورگر partهای بازیابی‌شده را skip می‌کند، concurrency را محدود می‌کند و complete را با ETagهای مرتب می‌فرستد.
- type/extension و سقف حجم قبل از آغاز کنترل می‌شود؛ پس از complete اندازه واقعی object با مقدار اعلامی تطبیق داده می‌شود.
- inspection worker اختصاصی فایل خصوصی را در scratch محدود دانلود می‌کند، signature و SHA-256 را محاسبه می‌کند و ffprobe را بدون shell، با timeout و خروجی محدود اجرا می‌کند. container، codec، duration و resolution فقط پس از تطبیق چندلایه ثبت می‌شوند.
- فایل معتبر به `processing` و فایل ردشده به `failed` با failure code پایدار می‌رود؛ هیچ source در وضعیت `inspecting|probing|processing` قابل پخش نیست.
- transcode اختصاصی HLS/CMAF با پروفایل‌های بدون upscale در 360p/720p، سگمنت‌های immutable و انتشار اتمیک rendition پیاده شده است.
- delivery خصوصی با ticket کوتاه‌عمر و room-scoped و manifest بازنویسی‌شده پیاده شده است؛ در توسعه/پایلوت سگمنت از API هم‌مبدأ proxy می‌شود و در production می‌توان delivery مستقیم CDN/object storage را با feature flag فعال کرد.
- پلیر HLS به stage اتاق وصل شده است؛ HLS.js فقط هنگام وجود پخش مشترک lazy-load می‌شود و Safari از HLS بومی استفاده می‌کند.
- sync کلاینت از snapshot مرجع، clock-offset، اجرای زمان‌بندی‌شده PLAY، اصلاح نرم drift تا ۳٪، hard seek، reconnect/late join/visibility recovery و fallback ده‌ثانیه‌ای استفاده می‌کند. در stream درحال رشد، رسیدن به frontier یک BUFFERING مشترک ایجاد می‌کند و پس از ایجاد ۱۰ ثانیه حاشیه امن، پخش گروهی از anchor مشترک ادامه پیدا می‌کند.
- کنترل Play/Pause/Seek میزبان optimistic است و بعد از ثبت REST فقط invalidation نسخه‌دار روی LiveKit منتشر می‌شود.
- UI کتابخانه شخصی در Tools اتاق برای میزبان/هم‌میزبان شامل انتخاب فایل، progress، resume پس از refresh با انتخاب مجدد همان فایل، وضعیت پردازش، شروع/ادامه، پایان برای همه و حذف دستی اضافه شده است.
- Compose توسعه شامل MinIO خصوصی loopback، init idempotent bucket و media worker دارای FFmpeg است؛ URL امضاشده host روی `localhost:9000` تولید می‌شود.
- suite فعلی backend شامل ۶۹ تست پاس و ۴ runtime opt-in skip است. ۹۹ تست کامل frontend، TypeScript، ESLint، build و بودجه bundle نیز بدون خطا هستند.

محدوده‌ای که هنوز عمداً پیاده نشده: readiness dashboard، telemetry، cleanup دوره‌ای، صفحه مستقل کتابخانه خارج اتاق و corpus واقعی FFmpeg. endpoint `create` رکورد metadata می‌سازد، multipart آن را وارد inspection و سپس transcode می‌کند؛ فقط rendition اتمیک منتشرشده قابل delivery است.

اصلاح پس از تست میدانی ۲۰۲۶-۰۸-۲۹:

- polling کتابخانه از state بسته‌شده در closure جدا شد؛ آماده‌شدن asset بدون خروج و ورود مجدد دکمه شروع را فعال می‌کند.
- Shared Player از همان participant strip ارائه استفاده می‌کند و خطای fatal HLS را به retry قابل مشاهده تبدیل می‌کند.
- اتصال HLS ابتدا MediaSource را attach و سپس manifest را load می‌کند.
- H.264/AAC با fast remux زودتر منتشر می‌شود؛ در مسیر encode نیز 360p پیش از پایان 720p با `partially_playable` قابل استفاده است.
- این تغییرها زمان بعد از complete را کاهش می‌دهند؛ پخش در حین upload به ingest جداگانه نیاز دارد و در [Spike اجرایی progressive ingest](./progressive-media-ingest-spike.md) تعریف شده است.

اصلاح پس از تست سه‌کاربره ۲۰۲۶-۰۸-۳۰:

- polling وضعیت stream درحال رشد به یک ثانیه کاهش یافت تا frontier و ساعت مرجع سریع‌تر reconcile شوند.
- نزدیک frontier، میزبان/هم‌میزبان BUFFERING مشترک ثبت می‌کند؛ کل گروه به‌جای توقف‌های مستقل صبر می‌کند و پس از ۱۰ ثانیه buffer امن، PLAY زمان‌بندی‌شده صادر می‌شود.
- خطاهای fatal شبکه/مدیا تا سه مرحله به‌صورت خودکار با `startLoad`، بازیابی decoder و ticket تازه اصلاح می‌شوند؛ retry دستی آخرین fallback است و بازگشت به موقعیت canonical انجام می‌شود.
- انتخاب محلی Auto/360p/720p بر اساس levelهای واقعی manifest و کنترل مستقل mute/volume اضافه شد؛ این انتخاب‌ها timeline مشترک را تغییر نمی‌دهند.
- telemetry موقت playback هر دو ثانیه فقط برای moderatorها روی DataChannel غیرقابل‌اعتماد ارسال می‌شود؛ هویت از sender معتبر LiveKit گرفته می‌شود و گزارش stale پس از ۷ ثانیه حذف می‌گردد. داشبورد میزبان drift، buffer-ahead، recovery/error و کیفیت هر کاربر را نشان می‌دهد.
- سیاست versioned و server-authoritative پخش اکنون دو حالت دارد: `continuous` فقط در frontier آپلود همه را متوقف می‌کند؛ `strict` پس از ۵ ثانیه افت پایدار readiness با علت `readiness` گروه را متوقف و پس از ۳ ثانیه سلامت پایدار ادامه می‌دهد. برای اتاق تا ۵ نفر حضور همه و برای اتاق بزرگ‌تر quorum نوددرصدی لازم است.
- coordinator به‌صورت deterministic میزبان حاضر و در نبود او اولین هم‌میزبان حاضر است؛ علت BUFFERING در session ذخیره می‌شود تا frontier و readiness یکدیگر را اشتباه resume نکنند.
- لاگ لوکال نشان داد progressive ingest حدود ۱۹۶ ثانیه و transcode نهایی حدود ۴۷۷ ثانیه طول کشیده و heartbeatهای worker نیز از دست رفته‌اند؛ محدودسازی CPU/threads و telemetry منابع جزو قدم بعد است.

### فاز یک — Shared Player MVP با فایل آماده، حدود ۳ تا ۵ هفته

- API کتابخانه و UI داخل اتاق برای list/create/delete/history/start/continue تکمیل؛ صفحه مستقل مدیریت پیشرفته باقی است؛
- upload مستقیم قابل ازسرگیری و validation اولیه همراه UI تکمیل؛ تنظیم CORS storage محیط production باقی است؛
- فقط assetهای دارای rendition منتشرشده؛
- پلیر HLS Auto و انتخاب دستی renditionهای موجود (360p/720p/source) تکمیل؛
- کنترل میزبان، snapshot REST، پیام versioned LiveKit، reconnect/late join تکمیل؛
- readiness dashboard و سیاست‌های خودکار Continuous/Strict Sync تکمیل؛ تنظیم threshold با داده پایلوت باقی است؛
- i18n فارسی/انگلیسی، RTL، mobile و accessibility؛
- telemetry اولیه TTFF/rebuffer/drift/readiness.

### فاز دو — Pipeline و کتابخانه مدیریتی، حدود ۴ تا ۷ هفته

- probe و sandbox امن (تکمیل؛ corpus runtime باقی است)؛
- transcode به HLS/CMAF 360p/720p و delivery خصوصی (تکمیل؛ CDN production باقی است)؛
- thumbnail، metadata، خطا/retry و quota؛
- صفحه مدیریت مدیا با جست‌وجو، وضعیت، حجم، مدت، مصرف و حذف دستی؛
- تأیید حذف، audit log، orphan cleanup و cost guardrails؛
- نمایش «آخرین پخش گروهی» و ادامه در جلسه بعد؛
- انتخاب managed/self-hosted پس از benchmark هزینه و دسترسی منطقه‌ای.

### فاز سه — پخش پیش از تکمیل آپلود، فقط بعد از Spike موفق، حدود ۴ تا ۸ هفته

- client preflight برای profileهای سازگار؛
- resumable upload با durable contiguous staging؛
- انتشار incremental سگمنت‌های immutable؛
- `published_duration_ms` و seek guard؛
- throughput predictor و جلوگیری از رسیدن player به ingest frontier؛
- fallback شفاف به upload-complete؛
- rollout محدود با feature flag.

Go/No-Go این فاز بر اساس corpus حداقل ۱۰۰ فایل واقعی، نرخ fast-path، هزینه encode، restart/resume و stall تعیین می‌شود.

### فاز چهار — تجربه سینمایی پیشرفته

- handoff از live contribution به VOD برای شروع فوری؛
- subtitle/caption workflow، چند audio track و audio ducking؛
- moderator transfer و readiness policy پیشرفته؛
- analytics کیفیت به تفکیک ISP/device؛
- 1080p و hardware encoding فقط با شواهد هزینه/کیفیت.

## تصمیم‌های باز پیش از فاز یک

1. اولویت تجاری: کمترین زمان عرضه، کنترل کامل داده، یا کمترین هزینه؟
2. provider خارجی از نظر پرداخت، قرارداد و شبکه هدف قابل استفاده است؟
3. MVP فقط Desktop upload باشد یا Mobile upload نیز لازم است؟
4. حداکثر duration/resolution/size هر plan چیست؟
5. مدیای مشترک باید در recording نهایی جلسه دیده شود یا نه؟
6. پیش‌فرض کلاس Continuous Sync باشد یا Strict Sync؟
7. آیا در فاز بعد کتابخانه تیمی مستقل و ACL لازم است یا کتابخانه شخصی میزبان برای Pilot کافی است؟

## قواعد حذف و نگهداری

- پیش‌فرض `retention_policy=manual` و `expires_at=null` است.
- پایان اتاق یا پایان جلسه هیچ assetی را حذف نمی‌کند.
- حذف یک عملیات دومرحله‌ای است: soft-delete و قطع دسترسی، سپس cleanup فایل‌ها توسط worker.
- asset دارای playback باز حذف نمی‌شود.
- history و AuditLog پس از حذف فایل برای سیاست ممیزی حفظ می‌شوند.
- quota با archive/plan/approval مدیریت می‌شود، نه حذف خودکار خاموش.

## الزامات Object Storage برای multipart

- bucket خصوصی است و public-read مجاز نیست.
- CORS فقط originهای رسمی Web را برای `PUT` می‌پذیرد و header پاسخ `ETag` را expose می‌کند.
- URL هر part حداکثر ۱۵ دقیقه اعتبار دارد؛ upload session پیش‌فرض ۲۴ ساعت.
- کلید object از UUID سرور ساخته می‌شود و filename کاربر وارد مسیر storage نمی‌شود.
- فایل complete‌شده قبل از magic/container/codec probe و پردازش، stream یا download نمی‌شود.
- ffprobe روی worker اختصاصی `media` با concurrency برابر ۱ اجرا می‌شود تا فایل‌های بزرگ با recording/document taskها رقابت نکنند.
- cleanup دوره‌ای باید multipartهای منقضی و objectهای orphan را abort/delete کند.

## شاخه‌های بعدی پیشنهادی

- `feat/shared-media-player-mvp`
- `feat/media-library-upload-pipeline`
- `feat/progressive-media-ingest`
- `feat/shared-media-observability`
