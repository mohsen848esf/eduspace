import type { DriveStep } from "driver.js";

export interface TourConfig {
  id: string;
  version: string;
  steps: (isRTL: boolean) => DriveStep[];
}

export const toursList: Record<string, TourConfig> = {
  "/dashboard": {
    id: "dashboard",
    version: "1.0",
    steps: (isRTL) => [
      {
        popover: {
          title: isRTL ? "خوش آمدید!" : "Welcome to EduSpace!",
          description: isRTL
            ? "به سامانه مدیریت آموزشی هوشمند ادواسپیس خوش آمدید. بیایید نگاهی سریع به داشبورد بیاندازیم."
            : "Welcome to EduSpace intelligent learning management system. Let's take a quick tour of your workspace.",
          side: "left",
          align: "center",
        },
      },
      {
        element: "#live-now-banner, #next-up-countdown",
        popover: {
          title: isRTL ? "کلاس‌های زنده و مهلت‌ها" : "Live Classes & Deadlines",
          description: isRTL
            ? "کلاس‌های فعال در این قسمت نمایش داده می‌شوند تا بتوانید مستقیماً وارد شوید."
            : "View active live sessions and countdowns here, allowing you to join streams directly.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: "#topbar-actions",
        popover: {
          title: isRTL ? "تنظیمات کاربری سریع" : "Quick Actions",
          description: isRTL
            ? "از این بخش می‌توانید زبان برنامه را تغییر داده، تم تاریک/روشن را فعال کنید یا راهنما را باز کنید."
            : "Toggle interface languages, switch dark/light theme options, or invoke help articles.",
          side: "bottom",
          align: "end",
        },
      },
    ],
  },
  "/academic/courses": {
    id: "courses",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#courses-grid",
        popover: {
          title: isRTL ? "دوره‌های آموزشی" : "Academic Courses",
          description: isRTL
            ? "تمام دوره‌های تعریف شده در سازمان شما در این بخش نشان داده می‌شوند."
            : "All courses defined in your academy context are organized here.",
          side: "top",
          align: "center",
        },
      },
    ],
  },
  "/academic/classes": {
    id: "classes",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#classes-grid",
        popover: {
          title: isRTL ? "کلاس‌های فعال" : "Active Classes",
          description: isRTL
            ? "کلاس‌های درس ترم جاری را در این بخش مشاهده و مدیریت کنید."
            : "Monitor and access active class enrollments for the current semester.",
          side: "top",
          align: "center",
        },
      },
    ],
  },
  "/academic/sessions": {
    id: "sessions",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#sessions-table",
        popover: {
          title: isRTL ? "لیست جلسات" : "Scheduled Sessions",
          description: isRTL
            ? "تقویم و لیست جلسات زنده، زمان کلاس‌ها و جلسات آرشیو شده را در این جدول مشاهده کنید."
            : "Track scheduled sessions, live times, and historical classroom listings in this grid.",
          side: "top",
          align: "center",
        },
      },
    ],
  },
  "/finance/ledger": {
    id: "ledger",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#ledger-summary",
        popover: {
          title: isRTL ? "خلاصه دفتر مالی" : "Financial Ledger Overview",
          description: isRTL
            ? "گزارش‌های درآمد، هزینه‌ها و بدهی‌های کل سازمان را در اینجا ببینید."
            : "Monitor aggregate receivables, invoices, and operating expenses.",
          side: "bottom",
          align: "center",
        },
      },
    ],
  },
  "/crm/members": {
    id: "members",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#members-table",
        popover: {
          title: isRTL ? "لیست اعضای سازمان" : "Members Directory",
          description: isRTL
            ? "دانش‌آموزان، اساتید و مدیران را مدیریت و نقش‌های آن‌ها را ویرایش کنید."
            : "Invite, view status, assign contracts, and regulate user privileges.",
          side: "top",
          align: "center",
        },
      },
    ],
  },
  "/recordings": {
    id: "recordings",
    version: "1.0",
    steps: (isRTL) => [
      {
        element: "#recordings-shelf",
        popover: {
          title: isRTL ? "آرشیو ویدیوها" : "Recordings Shelf",
          description: isRTL
            ? "ویدیوهای ضبط‌شده کلاس‌های گذشته را پخش کرده یا در وضعیت انتشار آن‌ها بازنگری کنید."
            : "Stream past recorded classrooms and change access publish controls.",
          side: "top",
          align: "center",
        },
      },
    ],
  },
};
