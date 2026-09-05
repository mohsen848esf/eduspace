# Responsive Design Mockups

این پوشه فقط برای **پیش‌نمایش طراحی** ساخته شده — هیچ ربطی به کد frontend اصلی نداره.

## نحوه دیدن

فایل `index.html` رو توی مرورگر باز کن. (نیاز به build، dev server یا dependency نداره — Tailwind از CDN لود می‌شه.)

```bash
# از ریشه پروژه:
xdg-open design-mockups/index.html        # Linux
open design-mockups/index.html             # macOS
start design-mockups/index.html            # Windows
```

یا فقط فایل HTML رو دابل کلیک کن.

## ساختار

- یک نوار بالایی برای جابجایی بین صفحات
- هر صفحه سه نسخه کنار هم نشون می‌ده:
  - **Mobile** — 375px
  - **Tablet** — 768px
  - **Desktop** — 1280px (طراحی فعلی)

## صفحات شامل شده

1. **Dashboard** — Bottom Nav + Drawer در موبایل، Collapsed sidebar در تبلت
2. **Sign In** — Card فول‌ویدث در موبایل
3. **Sign Up** — Stack عمودی فیلدها در موبایل
4. **Pre-Join** — Stack در موبایل، 2 ستونه از تبلت به بالا
5. **In-Call (default)** — Video grid + RoomControls
6. **In-Call · Chat** — Bottom Sheet در موبایل
7. **In-Call · Tools** — Bottom Sheet @90% در موبایل با لیست ابزارها

## بعد از تأیید

این پوشه برای شیپ کردن نیست. وقتی طراحی نهایی شد، می‌تونیم:
- این پوشه رو نگه داریم به عنوان رفرنس طراحی (داخل `/docs` یا همین جا)
- یا حذفش کنیم و فقط روی پیاده‌سازی واقعی توی `frontend/src` کار کنیم
