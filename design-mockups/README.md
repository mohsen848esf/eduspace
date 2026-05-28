# Responsive Design Mockups (v2)

این پوشه فقط برای **پیش‌نمایش طراحی** ساخته شده — هیچ ربطی به کد frontend اصلی نداره و قرار نیست merge بشه.

> **Branch**: `design/responsive-mockups-v2` (از `develop` شاخه شده)

## نحوه دیدن

فایل `index.html` رو توی مرورگر باز کن. (نیاز به build، dev server یا dependency نداره — Tailwind و فونت‌ها از CDN لود می‌شن.)

```bash
# از ریشه پروژه:
xdg-open design-mockups/index.html        # Linux
open design-mockups/index.html             # macOS
start design-mockups/index.html            # Windows
```

یا فقط فایل HTML رو دابل کلیک کن.

## ویژگی‌ها

### 🔁 Toggle EN/FA با RTL
بالای صفحه دکمه‌ی `EN | FA` هست. وقتی روی FA کلیک کنی:
- `dir="rtl"` روی `<html>` اعمال می‌شه
- فونت به Vazirmatn سوییچ می‌شه
- تمام متن‌ها به فارسی نمایش داده می‌شن
- تمام چیدمان (سایدبار، آیکون‌ها، گفت‌وگوها) خودبه‌خود معکوس می‌شن (به لطف `start/end` و `ms/me`)

### 📱 سه نسخه‌ی هر صفحه کنار هم
- **Mobile** — 375px
- **Tablet** — 768px
- **Desktop** — 1280px (طراحی فعلی)

### 🎨 پالت رنگ دقیق پروژه
از همون CSS variables پروژه استفاده شده:
- `--s0: #0f0f17` (background)
- `--s1: #16161f`, `--s2: #1e1e2a`, `--s3: #272735` (surfaces)
- `--brand: #6366f1`
- `--t1`, `--t2`, `--t3` (متن‌ها)

## صفحات شامل شده

| # | Tab | Mobile | Tablet | Desktop |
|---|-----|--------|--------|---------|
| 1 | Dashboard | Topbar+Bottom Nav (4 آیتم با CTA مرکزی) + Drawer | Sidebar collapsed 56px | Full sidebar 224px |
| 2 | Sign In | Inputs تمام عرض، touch target 44px | Card 384px وسط | Card 384px وسط |
| 3 | Sign Up | Stack عمودی فیلدها | Card 440px با password 2-col | Card 384px |
| 4 | Pre-Join | Stack + sticky CTA پایین | 2 col (preview/settings) | 2 col 840px |
| 5 | In-Call · Video | **Swipe page 1/4** | Panel docked | فعلی |
| 6 | In-Call · People | **Swipe page 2/4** + mini video strip | Panel docked | فعلی |
| 7 | In-Call · Chat | **Swipe page 3/4** + mini video strip | Panel docked | فعلی |
| 8 | In-Call · Tools | **Swipe page 4/4** + mini video strip | Panel docked + thumbs | فعلی |

## تصمیمات کلیدی

### 🧭 Bottom Nav (موبایل)
چهار آیتم با **CTA دایره‌ای وسط**:
1. **Home** (Dashboard)
2. **Calls**
3. **[+]** ← CTA — bottom sheet با Quick Actions
4. **More** ← drawer با بقیه: Games, Exams, Students, Reports, Recordings, Settings, Sign out

> Dashboard و Calls اصلی هستن. Games/Exams/... موقتاً توی More می‌رن چون قراره عوض بشن.

### 🎬 Mobile In-Call: Swipe Pages
کاربر روی صفحه‌ی موبایل بین چهار صفحه swipe می‌کنه:
```
[1. Video] ←→ [2. People] ←→ [3. Chat] ←→ [4. Tools]
```
- نقطه‌های pagination پایین صفحه
- در صفحات 2/3/4 یک **mini video strip** بالا قابل اسکرول هست تا کاربر همچنان متوجه باشه چی توی ویدیو می‌گذره
- Bottom Sheet به‌عنوان alternative بعداً اضافه می‌شه و کاربر می‌تونه از Settings انتخاب کنه

### 🌐 RTL-aware
همه‌ی margin/padding/border/positioning با logical properties:
- `ms-*` / `me-*` به جای `ml-*` / `mr-*`
- `start-*` / `end-*` به جای `left-*` / `right-*`
- `border-s` / `border-e` به جای `border-l` / `border-r`
- `rounded-ss-*` / `rounded-se-*` به جای `rounded-tl-*` / `rounded-tr-*`

## بعد از تأیید

این پوشه برای شیپ کردن نیست. وقتی طراحی نهایی شد:
- این پوشه رو یا به `/docs/design/` منتقل می‌کنیم به‌عنوان رفرنس
- یا حذفش می‌کنیم
- و روی پیاده‌سازی واقعی توی `frontend/src` با همین تصمیمات کار می‌کنیم
