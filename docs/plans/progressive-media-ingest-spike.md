# Spike اجرایی پخش ویدئو حین آپلود

وضعیت: P3.1 تا P3.3 در محیط توسعه تأیید شده؛ پایلوت محلی پشت دو feature flag فعال است و rollout عمومی هنوز انجام نشده است
شاخه مبنا: `feat/shared-media-cinema-foundation`
تاریخ: ۲۰۲۶-۰۸-۲۹

## مسئله‌ای که تست واقعی آشکار کرد

- فایل ۱۵٫۶ مگابایتی با مدت ۹ دقیقه و ۴۱ ثانیه، پس از تکمیل upload حدود ۱۲۲ ثانیه برای ساخت 360p و 720p منتظر ماند.
- فایل ۱۵۰٫۳ مگابایتی با مدت حدود ۵۵ دقیقه و ۴۴ ثانیه، روی worker تک‌پردازه بیش از ده دقیقه در `processing` ماند.
- Multipart Upload فعلی فقط partها را نگه می‌دارد. object قابل `GET` بعد از `CompleteMultipartUpload` ساخته می‌شود؛ بنابراین FFmpeg نمی‌تواند در حین همان upload فایل را بخواند. [مستند رسمی AWS S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- در MP4 معمولی metadata ممکن است انتهای فایل باشد؛ `faststart` آن را به ابتدا می‌آورد و fragmented MP4 metadata را کنار fragmentها نگه می‌دارد. این تفاوت تعیین می‌کند فایل قبل از رسیدن آخرین byte قابل ingest هست یا نه. [مستند رسمی FFmpeg](https://ffmpeg.org/ffmpeg-formats.html#Fragmentation)

نتیجه: با قرارداد Multipart فعلی، «پخش حین آپلود» از نظر فنی ممکن نیست. polling سریع‌تر یا نمایش درصد، این محدودیت را حل نمی‌کند.

## اصلاح فوری موجود در همین شاخه

این اصلاح، زمان بعد از تکمیل upload را کم می‌کند ولی جای ingest واقعی را نمی‌گیرد:

1. فایل H.264/AAC ابتدا بدون encode مجدد به HLS/fMP4 remux می‌شود و سریع قابل پخش می‌گردد.
2. اگر fast remux ممکن نباشد، 360p به‌محض تکمیل خودش با حالت `partially_playable` منتشر می‌شود.
3. ساخت 720p بعد از قابل‌پخش‌شدن 360p ادامه پیدا می‌کند.
4. کتابخانه هر دو ثانیه وضعیت تازه را می‌گیرد و بدون خروج/ورود دوباره دکمه شروع را فعال می‌کند.
5. HLS خطای fatal را به retry قابل‌مشاهده تبدیل می‌کند؛ صفحه برای همیشه سیاه نمی‌ماند.

## معماری fast-path واقعی

### قرارداد ذخیره‌سازی

در fast-path، هر chunk یک object خصوصی و مستقل است، نه part مخفی یک Multipart Upload:

```text
ingest/{owner_subject}/{upload_token}/chunks/00000001.bin
ingest/{owner_subject}/{upload_token}/chunks/00000002.bin
...
```

- اندازه اولیه chunk: ۴ تا ۸ MiB؛ مقدار نهایی با benchmark شبکه تعیین می‌شود.
- مرورگر chunkها را مستقیم با URL کوتاه‌عمر به storage می‌فرستد.
- پس از `HEAD` و تطبیق اندازه/checksum، Backend فقط frontier پیوسته را جلو می‌برد.
- chunk خارج ترتیب قابل upload است، اما worker فقط تا آخرین شماره پیوسته مصرف می‌کند.
- complete شدن upload یک event نهایی است؛ پاک‌سازی chunkها فقط بعد از ساخت source نهایی و تأیید checksum انجام می‌شود.

### preflight سازگاری

Fast-path فقط برای ورودی‌ای فعال می‌شود که probe محدود اولیه آن را streamable تشخیص دهد:

- MP4 fragmented، یا MP4 دارای metadata لازم در ابتدای فایل؛
- codecهای ورودی مورد قبول worker؛
- ابعاد، نرخ داده و headerهای اولیه داخل policy؛
- فایل رمزگذاری‌شده، ساختار مشکوک، metadata انتهایی نامناسب یا container ناشناخته به مسیر fallback می‌رود.

تصمیم کلاینت صرفاً hint است؛ worker مستقل آن را دوباره اعتبارسنجی می‌کند. ورودی ناسازگار upload خود را از دست نمی‌دهد و با Multipart فعلی تا انتها ادامه می‌دهد.

### worker ingest

1. بعد از رسیدن prefix کافی، worker sandboxشده شروع می‌شود.
2. reader، chunkهای پیوسته را به یک stream blocking می‌دهد؛ EOF فقط پس از complete واقعی ارسال می‌شود.
3. FFmpeg خروجی HLS event با segmentهای immutable دوثانیه‌ای تولید می‌کند.
4. manifest منتشرشده فقط segmentهای کامل را شامل می‌شود.
5. Backend پس از هر batch، `published_duration_ms` را اتمیک افزایش می‌دهد.
6. بعد از پایان upload، playlist به VOD نهایی تبدیل و source کامل برای کتابخانه نگهداری می‌شود.

FFmpeg از HLS با fMP4 و `append_list` پشتیبانی می‌کند، اما رفتار restart، playlist recovery و ورودی non-seekable باید با corpus واقعی اثبات شود. [مستند HLS در FFmpeg](https://ffmpeg.org/ffmpeg-formats.html#hls-2)

## قرارداد player در مرز ingest

- seek حداکثر تا `published_duration_ms - safety_guard_ms` مجاز است.
- مقدار اولیه safety guard برابر ۸ ثانیه است.
- اگر فاصله player با frontier کمتر از guard شود، UI به‌جای stall نامفهوم وضعیت «در انتظار ادامه آپلود» نشان می‌دهد.
- شروع گروهی فقط وقتی مجاز است که حداقل ۱۲ تا ۲۰ ثانیه media منتشر شده باشد.
- throughput predictor باید سرعت upload/encode را با bitrate پخش مقایسه کند؛ اگر روند منفی است، میزبان هشدار می‌گیرد یا شروع محدود می‌شود.
- viewerها همچنان از HLS/CDN می‌خوانند؛ uploader هیچ ویدئویی را با WebRTC برای دیگران relay نمی‌کند.

## state machine پیشنهادی

```text
created
  -> uploading_fallback -> inspecting -> processing -> partially_playable -> ready
  -> uploading_fast -> ingesting -> partially_playable -> finalizing -> ready
                                 \-> fallback_required
  -> failed
```

`upload_progress_bytes`، `contiguous_bytes`، `published_duration_ms` و `processing_progress` چهار مقدار جدا هستند. UI نباید درصد byte را معادل مدت قابل پخش نشان دهد.

## failure و recovery

- refresh مرورگر: فهرست chunkهای commit‌شده بازیابی و فقط chunkهای گمشده ارسال می‌شوند.
- restart worker: manifest و آخرین sequence معتبر خوانده، سپس از checkpoint ingest ادامه داده می‌شود؛ موفقیت این مسیر شرط Go است.
- قطع upload: segmentهای موجود تا مدت grace قابل پخش می‌مانند، اما شروع جدید ممنوع می‌شود.
- شکست fast-path: upload به fallback کامل سوییچ می‌کند و خطای فنی به کاربر وعده اشتباه نمی‌دهد.
- checksum نهایی نامعتبر: asset قرنطینه و delivery قطع می‌شود.
- cleanup: chunkهای orphan و ingestهای منقضی policy و metric مستقل دارند.

## امنیت و استقرار

- FFmpeg ingest قبل از کامل‌شدن فایل فقط در worker اختصاصی، بدون shell، با CPU/memory/time/output limit اجرا می‌شود.
- storage private، key سرورساز، URL کوتاه‌عمر و checksum هر chunk اجباری است.
- ingest باید از web/API process جدا باشد؛ در استخراج پروژه تماس، این جزء یک سرویس داخلی Call Media محسوب می‌شود و Organization را نمی‌شناسد.
- برای production، صف ingest و صف transcode نهایی concurrency و autoscaling جدا دارند.

## برش‌های پیاده‌سازی

### وضعیت اجرایی در ۲۰۲۶-۰۸-۳۰

- مدل‌های provider-neutral به نام‌های `ProgressiveMediaUpload` و `ProgressiveMediaChunk` و migration آن‌ها اضافه شده‌اند؛ مالکیت فقط به user/subject وصل است و وابستگی Organization ندارد.
- APIهای capability، initiate، status، sign chunk، commit chunk و complete وجود دارند، اما `MEDIA_PROGRESSIVE_UPLOAD_ENABLED=False` پیش‌فرض است.
- هر chunk یک object خصوصی مستقل است. commit فقط بعد از `HEAD` و تطبیق اندازه و ETag پذیرفته می‌شود؛ worker سپس SHA-256 را از خود storage محاسبه می‌کند.
- frontierهای uploaded و verified فقط روی sequence پیوسته جلو می‌روند؛ chunk خارج ترتیب frontier را به‌اشتباه جلو نمی‌برد.
- detector محدود ISO-BMFF روی بایت واقعی storage، MP4 fast-start/fragmented را از `moov` پس از `mdat` جدا می‌کند. detector مرورگر صرفاً preflight است و تصمیم امنیتی نیست.
- complete فقط وقتی مجاز است که همه chunkها verify شده باشند. سپس MinIO/S3 با multipart copy یک source نهایی می‌سازد و همان inspection/transcode تثبیت‌شده را ادامه می‌دهد.
- قرارداد frontend در حالت پیش‌فرض غیرفعال است. UI فقط وقتی هر دو flag پایلوت روشن باشند و capability مقدار `play_while_uploading: true` بدهد مسیر progressive را انتخاب می‌کند؛ در غیر این صورت محصول ادعای پخش حین upload نمی‌کند.
- پاک‌سازی orphan، reconcile provider، corpus صدتایی و checkpoint recovery بی‌وقفه جزو کار باقی‌مانده‌اند.

### برش P3.3 تأییدشده در runtime توسعه — ۲۰۲۶-۰۸-۳۰

- صف و worker مستقل `media-ingest` اضافه شده است؛ ingest منتظر chunk بعدی می‌ماند و صف کوتاه verification/transcode را اشغال نمی‌کند.
- worker فقط chunkهای دارای SHA-256 تأییدشده را به‌ترتیب sequence از storage می‌خواند و روی stdin غیرقابل seek به FFmpeg می‌دهد.
- FFmpeg یک rendition پایلوت 360p با HLS/fMP4 نوع EVENT، segment دوثانیه‌ای، فایل موقت و انتشار اتمیک تولید می‌کند.
- publisher ابتدا init/segment کامل را در storage قرار می‌دهد و سپس manifest تازه را منتشر می‌کند. با رسیدن به ۱۲ ثانیه، asset به `partially_playable` می‌رود.
- heartbeat، lease سی‌ثانیه‌ای، `acks_late` و prefix جدید به‌ازای هر attempt از دو ingest هم‌زمان جلوگیری و rebuild پس از worker-loss را ممکن می‌کنند. این recovery فعلاً rebuild از chunk اول است، نه ادامه بی‌وقفه از segment قبلی.
- finalize، source کامل را با multipart-copy می‌سازد ولی اگر ingest زنده هنوز فعال باشد inspection را تا پایان آن عقب می‌اندازد؛ پایان یا fallback worker سپس pipeline نهایی inspection/transcode را صف می‌کند.
- قرارداد playback دو مقدار جدا دارد: `published_duration_ms` و `seekable_until_ms`. هنگام رشد، seek/start هشت ثانیه عقب‌تر از frontier محدود است؛ pause/stop می‌تواند موقعیت واقعاً دیده‌شده را تا خود frontier ثبت کند.
- snapshot هنگام رشد هر دو ثانیه تازه می‌شود و player در مرز امن پیام «در انتظار رسیدن بخش بعدی» نشان می‌دهد.
- uploader مرورگر فقط وقتی capability با هر دو flag فعال `play_while_uploading=true` بدهد، MP4 را به chunk objectهای مستقل می‌فرستد؛ در غیر این صورت مسیر multipart موجود بدون تغییر استفاده می‌شود.
- delivery محلی/pilot اکنون init/segmentها را بدون redirect از endpoint همان API stream می‌کند. هر دو مسیر redirect `API -> MinIO` و دسترسی مستقیم مرورگر به hostname محلی storage در برخی Chrome/originها با network code صفر شکست می‌خوردند. حالت signed URL مستقیم برای CDN production پشت `MEDIA_PLAYBACK_DIRECT_OBJECT_URLS` باقی مانده است. مسیر proxy با همان asset واقعی در Chromium، `readyState=4`، حرکت timeline و دریافت چند fragment بدون خطا تأیید شد.
- player دارای timeline قابل‌مشاهده است؛ برگزارکننده فقط تا frontier امن seek می‌کند و بیننده همان timeline همگام را به‌صورت read-only می‌بیند.
- اگر detector فایل را به‌علت `moov` انتهایی یا ساختار ناسازگار به fallback ببرد، UI اکنون حین upload صریحاً اعلام می‌کند که پخش پس از تکمیل upload فعال خواهد شد.
- migration `0007_progressive_ingest_state.py` روی دیتابیس توسعه اعمال شد. ۶۶ تست backend پاس شدند (۴ تست runtime در host به‌طور مورد انتظار skip) و هر ۴ تست runtime داخل image واقعی با PostgreSQL، MinIO و FFmpeg پاس شدند؛ از جمله ingest از chunkهای مستقل و انتشار HLS نوع EVENT پیش از finalize.
- مقدار پیش‌فرض هر دو flag همچنان `False` است. فقط محیط توسعه محلی برای تست دستی با `MEDIA_PROGRESSIVE_UPLOAD_ENABLED=True` و `MEDIA_PROGRESSIVE_INGEST_ENABLED=True` فعال شده است.

### P3.1 — قرارداد و corpus

- مدل `ProgressiveIngestSession` و `IngestChunk` یا معادل provider-neutral؛ **انجام شد**
- detector برای MP4 fragmented/faststart؛ **نسخه محدود MP4 انجام شد، WebM باقی است**
- corpus حداقل ۱۰۰ فایل واقعی شامل فایل خراب، moov انتهایی، موبایل، screen recording و VFR؛
- feature flag و compose به pipeline fallback بدون از دست‌رفتن upload؛ **انجام شد**

### P3.2 — chunk upload و resumability

- sign/commit chunk؛ **انجام شد** — reconcile دوره‌ای باقی است
- contiguous frontier و checksum؛ **انجام شد**
- resume پس از refresh و cleanup orphan؛
- تست MinIO و S3-compatible provider منتخب.

### P3.3 — live ingest و delivery

- reader blocking و FFmpeg event HLS؛ **پیاده‌سازی و در runtime واقعی تأیید شد**
- انتشار incremental manifest/segment؛ **پیاده‌سازی و در runtime واقعی تأیید شد**
- heartbeat/lease و rebuild پس از restart؛ **پیاده‌سازی شد** — checkpoint ادامهٔ بی‌وقفه باقی است
- seek guard و نمایش مدت واقعی قابل پخش؛ **پیاده‌سازی شد**

### P3.4 — rollout و QoE

- feature flag برای درصد محدودی از میزبان‌ها؛
- TTFF از انتخاب فایل، ingest lag، fallback rate، rebuffer و drift؛
- Go/No-Go بر مبنای نرخ موفقیت fast-path، هزینه encode و recovery.

## معیار پذیرش Pilot

- فایل سازگار: p95 زمان انتخاب فایل تا اولین ۱۲ ثانیه قابل پخش کمتر از ۳۰ ثانیه روی uplink واجد شرایط.
- resume upload بدون ارسال دوباره chunk سالم.
- restart worker بدون خراب‌شدن timeline یا manifest.
- هیچ seekی جلوتر از frontier پذیرفته نشود.
- fallback فایل ناسازگار ۱۰۰٪ قابل‌فهم و بدون از دست‌رفتن داده باشد.
- تفاوت drift و rebuffer با فایل ازقبل‌آماده، جدا گزارش شود.
