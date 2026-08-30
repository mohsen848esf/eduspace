import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useLocale } from "../../i18n/useLocale";
import GlobalSearchModal from "./GlobalSearchModal";
import { Search } from "lucide-react";

interface BreadcrumbItem {
  name: string;
  url?: string;
}

const VALID_PATHS = new Set([
  "/dashboard",
  "/academic/courses",
  "/academic/classes",
  "/academic/sessions",
  "/academic/attendance",
  "/academic/assessments",
  "/leaderboard",
  "/academic/reports",
  "/crm/members",
  "/finance/ledger",
  "/settings/notifications",
  "/settings/templates",
  "/settings/organization",
  "/settings/billing",
  "/settings/profile",
  "/settings/security/change-password",
  "/miniapps",
  "/sys-admin",
  "/academic/homework",
  "/academic/payments",
]);

export default function SubTopbar() {
  const location = useLocation();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    const segments = location.pathname.split("/").filter(Boolean);

    const segmentNamesEn: Record<string, string> = {
      dashboard: "Dashboard",
      academic: "Academic",
      courses: "Courses",
      classes: "Classrooms",
      sessions: "Sessions",
      attendance: "Attendance",
      homework: "Homework",
      payments: "Payments",
      assessments: "Assessments",
      leaderboard: "Leaderboard",
      reports: "Reports",
      crm: "CRM",
      members: "Members",
      finance: "Finance",
      ledger: "Ledger",
      invoices: "Invoices",
      settings: "Settings",
      profile: "Profile",
      organization: "Organization",
      billing: "Billing",
      templates: "Templates",
      notifications: "Notifications",
      security: "Security",
      "change-password": "Change password",
      inbox: "Inbox",
    };

    const segmentNamesFa: Record<string, string> = {
      dashboard: "داشبورد",
      academic: "آموزش",
      courses: "دوره‌ها",
      classes: "کلاس‌های درس",
      sessions: "جلسات",
      attendance: "حضور و غیاب",
      homework: "تکالیف",
      payments: "پرداخت‌ها",
      assessments: "آزمون‌ها",
      leaderboard: "رتبه‌بندی",
      reports: "گزارش‌ها",
      crm: "مدیریت اعضا",
      members: "اعضا و پرسنل",
      finance: "امور مالی",
      ledger: "دفتر کل مالی",
      invoices: "صورت‌حساب‌ها",
      settings: "تنظیمات",
      profile: "پروفایل کاربری",
      organization: "تنظیمات سازمان",
      billing: "اشتراک و پرداخت",
      templates: "قالب‌ها",
      notifications: "اعلان‌ها",
      security: "امنیت",
      "change-password": "تغییر گذرواژه",
      inbox: "صندوق پیام‌ها",
    };

    let currentPath = "";
    segments.forEach((seg) => {
      currentPath += `/${seg}`;

      // Ignore dynamic IDs
      const isId = /^\d+$/.test(seg) || /^[0-9a-fA-F-]{8,}$/.test(seg);
      if (isId) return;

      const label = isFarsi ? segmentNamesFa[seg] || seg : segmentNamesEn[seg] || seg;
      items.push({
        name: label,
        url: currentPath,
      });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbItems();

  const isPathValid = (path?: string) => {
    if (!path) return false;
    return VALID_PATHS.has(path);
  };

  return (
    <div className="h-10 flex-shrink-0 flex items-center justify-between gap-4 px-4 md:px-5 bg-transparent border-b border-[var(--b)]/40 transition-colors">
      {/* Left / Start: Dynamic Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--t3)] font-medium select-none overflow-x-auto no-scrollbar">
        {breadcrumbs.map((item, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const canClick = !isLast && item.url && isPathValid(item.url);

          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-[var(--t3)]/60 mx-1">{isFarsi ? "‹" : "›"}</span>}
              {isLast ? (
                <span className="text-[var(--t1)] font-semibold">{item.name}</span>
              ) : canClick ? (
                <Link
                  to={item.url!}
                  className="hover:text-[var(--brand)] text-[var(--t3)] no-underline transition-colors"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="text-[var(--t3)]">{item.name}</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right / End: Search pill button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          className="flex items-center gap-2 px-3 py-1 bg-[var(--s2)]/70 hover:bg-[var(--s2)] border border-[var(--b)]/60 hover:border-[var(--brand)]/50 rounded-full text-xs text-[var(--t3)] hover:text-[var(--t1)] transition-all cursor-pointer shadow-none"
        >
          <Search className="w-3.5 h-3.5 text-[var(--t3)]" />
          <span className="hidden sm:inline">
            {isFarsi ? "جستجو در پلتفرم..." : "Search anything..."}
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[var(--s3)] border border-[var(--b)] rounded text-[var(--t3)]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <GlobalSearchModal open={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </div>
  );
}
