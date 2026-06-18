import { useLocation } from "react-router-dom";
import { Drawer, DrawerHeader, DrawerTitle, DrawerBody } from "../layout/Drawer";
import { useLocale } from "../../i18n/useLocale";
import { useTour } from "../tours/useTour";
import { BookOpen, Play, HelpCircle, X } from "lucide-react";

interface HelpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PageHelpItem {
  titleEn: string;
  titleFa: string;
  descEn: string;
  descFa: string;
  tipsEn: string[];
  tipsFa: string[];
}

const helpRegistry: Record<string, PageHelpItem> = {
  "/dashboard": {
    titleEn: "Dashboard Overview",
    titleFa: "نمای کلی داشبورد",
    descEn: "Your workspace hub for tracking online classes, assignments, schedules, and metrics.",
    descFa: "بخش اصلی کاربری شما جهت ردیابی کلاس‌های آنلاین، تکالیف، برنامه‌های زمان‌بندی و آمارها.",
    tipsEn: [
      "Check the countdown timer to see when your next session begins.",
      "Toggle dark/light mode and English/Farsi translation tools in the Topbar.",
      "Access student statistics or finance charts depending on your permissions."
    ],
    tipsFa: [
      "شمارش معکوس را چک کنید تا ببینید جلسه بعدی شما چه زمانی آغاز می‌شود.",
      "تم تاریک/روشن و ابزار زبان فارسی/انگلیسی را در نوار بالا تغییر دهید.",
      "بسته به دسترسی‌های خود به آمارهای دانشجویی یا نمودارهای مالی دسترسی پیدا کنید."
    ]
  },
  "/academic/courses": {
    titleEn: "Courses Catalogue",
    titleFa: "کاتالوگ دوره‌های آموزشی",
    descEn: "View and configure academic syllabi, course codes, and class associations.",
    descFa: "مشاهده و پیکربندی سرفصل‌های آموزشی، کدهای دوره و ارتباطات کلاسی.",
    tipsEn: [
      "Click on any course to drill down into its curriculum details.",
      "Use 'Add Course' to register a new course syllabus in the organization."
    ],
    tipsFa: [
      "بر روی هر دوره کلیک کنید تا جزئیات برنامه درسی آن را ببینید.",
      "از گزینه 'ایجاد دوره جدید' برای ثبت سرفصل آموزشی جدید استفاده کنید."
    ]
  },
  "/academic/classes": {
    titleEn: "Class Management",
    titleFa: "مدیریت کلاس‌ها",
    descEn: "Organize class semesters, student groups, teachers, and timeline settings.",
    descFa: "سازماندهی ترم‌های کلاسی، گروه‌های دانش‌آموزی، اساتید و تنظیمات زمانی.",
    tipsEn: [
      "Access class dashboards to assign homework tasks or track attendance sheets.",
      "Add classes to associate students with a specific course syllabus."
    ],
    tipsFa: [
      "به داشبورد کلاس بروید تا تکالیف را اختصاص داده یا لیست حضور و غیاب را ردیابی کنید.",
      "کلاس ایجاد کنید تا دانش‌آموزان را به یک سرفصل آموزشی خاص متصل کنید."
    ]
  },
  "/academic/sessions": {
    titleEn: "Class Schedule & Sessions",
    titleFa: "برنامه کلاس‌ها و جلسات",
    descEn: "Schedule and manage active classroom streams, schedules, and live video rooms.",
    descFa: "زمان‌بندی و مدیریت پخش جلسات کلاسی، برنامه‌ها و اتاق‌های ویدیوی زنده.",
    tipsEn: [
      "Launch active rooms as a teacher to enable whiteboard widgets and recording.",
      "Students can join live sessions directly from their calendar listings."
    ],
    tipsFa: [
      "به عنوان استاد کلاس زنده را شروع کنید تا تخته‌سفید و ابزار ضبط فعال شوند.",
      "دانش‌آموزان می‌توانند مستقیماً از برنامه تقویم خود وارد کلاس زنده شوند."
    ]
  },
  "/crm/members": {
    titleEn: "Organization Members",
    titleFa: "اعضای سازمان",
    descEn: "Invite users, track joined dates, regulate user contracts, and assign permission roles.",
    descFa: "دعوت از کاربران، ردیابی تاریخ‌های عضویت، تنظیم قراردادها و تخصیص نقش‌های دسترسی.",
    tipsEn: [
      "Send invitations specifying emails, user roles, and expiration dates.",
      "Suspended members automatically lose application dashboard privileges."
    ],
    tipsFa: [
      "دعوت‌نامه ارسال کنید و در آن ایمیل، نقش کاربر و تاریخ انقضا را مشخص کنید.",
      "دسترسی اعضای معلق‌شده به داشبورد برنامه به‌طور خودکار قطع می‌شود."
    ]
  },
  "/finance/ledger": {
    titleEn: "Financial Ledger & Invoices",
    titleFa: "دفتر مالی و فاکتورها",
    descEn: "Track revenues, operating expenses, payments, and invoice creation templates.",
    descFa: "ردیابی درآمدها، هزینه‌های جاری، پرداخت‌ها و الگوهای ایجاد فاکتور.",
    tipsEn: [
      "Generate manual tuition invoices using the date picker for due date values.",
      "Record expenses using standard cost types to keep charts balanced."
    ],
    tipsFa: [
      "فاکتورهای شهریه را به‌صورت دستی با استفاده از انتخاب‌گر تاریخ برای سررسید صادر کنید.",
      "هزینه‌ها را ثبت کنید تا تراز مالی نمودارها دقیق بماند."
    ]
  },
  "/recordings": {
    titleEn: "Class Recordings Shelf",
    titleFa: "آرشیو ضبط کلاس‌ها",
    descEn: "Access past recorded streams, manage publish settings, or modify title tags.",
    descFa: "دسترسی به ویدیوهای ضبط‌شده کلاس‌های گذشته، مدیریت تنظیمات انتشار یا ویرایش عنوان.",
    tipsEn: [
      "Click on any recording cell to load the video playback screen.",
      "Publish recordings so that students enrolled in the class can stream them."
    ],
    tipsFa: [
      "روی هر خانه ضبط کلیک کنید تا صفحه پخش ویدیو باز شود.",
      "ضبط‌ها را منتشر کنید تا دانش‌آموزان کلاس بتوانند ویدیو را تماشا کنند."
    ]
  }
};

export default function HelpDrawer({ open, onOpenChange }: HelpDrawerProps) {
  const location = useLocation();
  const { isRTL } = useLocale();
  const { startTour } = useTour();

  const currentPath = location.pathname;
  // Fallback if no exact match for child routes (e.g. nested detail pages)
  const matchingKey = Object.keys(helpRegistry).find(
    (key) => currentPath.startsWith(key)
  ) || "/dashboard";

  const helpData = helpRegistry[matchingKey];

  const handleStartTour = () => {
    onOpenChange(false);
    // Give modal exit animation a small delay before launching tour overlay
    setTimeout(() => {
      startTour(matchingKey, true);
    }, 250);
  };

  const title = isRTL ? helpData.titleFa : helpData.titleEn;
  const description = isRTL ? helpData.descFa : helpData.descEn;
  const tips = isRTL ? helpData.tipsFa : helpData.tipsEn;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="end"
      ariaLabel="Contextual Help Drawer"
      panelClassName="w-[380px]"
    >
      <DrawerHeader className="justify-between">
        <div className="flex items-center gap-2 text-[var(--brand-text)]">
          <HelpCircle className="w-5 h-5" />
          <DrawerTitle>{isRTL ? "راهنما و پشتیبانی" : "Help & Guidance"}</DrawerTitle>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </DrawerHeader>

      <DrawerBody className="p-5 flex flex-col gap-6">
        {/* Page summary section */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-[var(--t1)]">{title}</h3>
          <p className="text-xs text-[var(--t2)] leading-relaxed">{description}</p>
        </div>

        {/* Quick tour action trigger */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[var(--brand)]" />
            <span className="text-xs font-semibold text-[var(--t1)]">
              {isRTL ? "راهنمای تعاملی صفحه" : "Guided Page Tour"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--t2)]">
            {isRTL
              ? "یک راهنمای زنده برای آشنایی با دکمه‌ها و بخش‌های مختلف این صفحه آغاز کنید."
              : "Start a live interactive walk-through highlighting features on this screen."}
          </p>
          <button
            onClick={handleStartTour}
            className="w-full bg-[var(--brand)] hover:bg-[var(--brand-h)] text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
          >
            {isRTL ? "شروع تور تعاملی" : "Launch Guided Tour"}
          </button>
        </div>

        {/* Page Tips checklist */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[var(--t2)] font-semibold text-xs border-b border-[var(--b)] pb-1.5">
            <BookOpen className="w-4 h-4" />
            <span>{isRTL ? "نکات کاربردی" : "Useful Tips"}</span>
          </div>
          <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
            {tips.map((tip, idx) => (
              <li
                key={idx}
                className="text-xs text-[var(--t2)] flex gap-2 items-start leading-relaxed"
              >
                <span className="text-[var(--brand-text)] mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </DrawerBody>
    </Drawer>
  );
}
