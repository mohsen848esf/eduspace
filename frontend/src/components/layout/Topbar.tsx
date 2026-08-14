import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { useNotificationsStore } from "../../features/auth/store/notificationsStore";
import { Icons } from "../../lib/constants/icons";
import { useLocale } from "../../i18n/useLocale";
import NotificationsPopover from "./NotificationsPopover";
import GlobalSearchModal from "./GlobalSearchModal";
import { useRoom } from "../../features/room/hooks/useRoom";

interface TopbarProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  /** When true, render a leading hamburger button on the start side. */
  showHamburger?: boolean;
  /** Click handler for the hamburger; AppShell wires this to open the drawer. */
  onHamburgerClick?: () => void;
}

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
  "/recordings",
  "/settings/notifications",
  "/settings/templates",
  "/settings/organization",
  "/settings/billing",
  "/settings/profile",
  "/miniapps",
  "/sys-admin",
  "/academic/homework",
  "/academic/payments",
]);

export default function Topbar({
  title,
  isDark,
  onToggleTheme,
  showHamburger = false,
  onHamburgerClick,
}: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(["dashboard", "common", "auth", "notifications"]);
  const { language, toggleLanguage } = useLocale();
  const { user } = useAuthStore();
  const { createRoom, isLoading: roomLoading } = useRoom();

  const unreadCount = useNotificationsStore((s) =>
    s.items.filter((it) => it.readAt === null).length,
  );
  const bellRef = useRef<HTMLButtonElement>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const nextLanguageLabel =
    language === "en" ? t("common:language.persian") : t("common:language.english");

  const isFarsi = language === "fa";

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    
    // Parse pathname segments
    const segments = location.pathname.split("/").filter(Boolean);
    
    const segmentNamesEn: Record<string, string> = {
      dashboard: "Dashboard",
      academic: "Academic",
      courses: "Courses",
      classes: "Classroom",
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
      recordings: "Recordings",
      settings: "Settings",
      profile: "Profile",
    };

    const segmentNamesFa: Record<string, string> = {
      dashboard: "داشبورد",
      academic: "آموزش",
      courses: "دوره‌ها",
      classes: "کلاس درس",
      sessions: "جلسات",
      attendance: "حضور و غیاب",
      homework: "تکالیف",
      payments: "پرداخت‌ها",
      assessments: "آزمون‌ها",
      leaderboard: "امتیازات",
      reports: "گزارش‌ها",
      crm: "سی‌آرام",
      members: "اعضا",
      finance: "امور مالی",
      ledger: "دفتر مالی",
      recordings: "ویدیوها",
      settings: "تنظیمات",
      profile: "پروفایل",
    };

    let currentPath = "";
    segments.forEach((seg) => {
      currentPath += `/${seg}`;
      
      // Ignore if dynamic ID (numbers or UUIDs)
      const isId = /^\d+$/.test(seg) || /^[0-9a-fA-F-]{8,}$/.test(seg);
      if (isId) return;
      
      const label = isFarsi ? (segmentNamesFa[seg] || seg) : (segmentNamesEn[seg] || seg);
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
    <header className="h-16 flex-shrink-0 flex items-center justify-between gap-4 px-4 md:px-5 bg-[var(--s1)] border-b border-[var(--b)] transition-colors duration-300">
      {/* Left section: Hamburger / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu")}>
            <button
              onClick={onHamburgerClick}
              aria-label={t("dashboard:nav.openMenu")}
              className="w-10 h-10 -ms-1 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-colors duration-150 flex-shrink-0"
            >
              {Icons.menu}
            </button>
          </Tooltip>
        )}
        
        {/* Dynamic Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--t3)] font-medium select-none">
            {breadcrumbs.map((item, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const canClick = !isLast && item.url && isPathValid(item.url);
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-[var(--t3)] mx-0.5">&gt;</span>}
                  {isLast ? (
                    <span className="text-[var(--brand-text)] font-semibold">{item.name}</span>
                  ) : canClick ? (
                    <Link to={item.url!} className="hover:text-[var(--brand-text)] text-[var(--t3)] no-underline transition-colors">
                      {item.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--t3)]">{item.name}</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Dynamic single title if breadcrumbs not visible on smaller screens */}
        <div className="lg:hidden flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-[var(--t1)] truncate">
            {title}
          </span>
        </div>
      </div>

      {/* Middle section: Search pill input */}
      <div className="hidden md:flex items-center relative max-w-[240px] w-full mx-auto">
        <span className="absolute start-3 text-[var(--t3)] text-[11px]">🔍</span>
        <input
          type="text"
          placeholder={isFarsi ? "جستجوی دوره‌ها، فایل‌ها..." : "Search courses, docs..."}
          readOnly
          onClick={() => setShowSearchModal(true)}
          className="w-full bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)] rounded-full py-1.5 ps-9 pe-4 text-xs cursor-pointer text-[var(--t1)] focus:outline-none transition-all placeholder-[var(--t3)]"
        />
      </div>

      {/* Right section: Language, Theme, Notifications, New Meeting, Avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Tooltip content={t("common:language.switchTo", { language: nextLanguageLabel })}>
          <button
            onClick={toggleLanguage}
            className="px-2 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-xs font-semibold uppercase tracking-wider transition-all duration-150"
          >
            {language === "en" ? "EN" : "FA"}
          </button>
        </Tooltip>

        <Tooltip content={isDark ? t("topbar.switchToLight") : t("topbar.switchToDark")}>
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        {/* Notifications inbox with red dot */}
        <div className="relative">
          <Tooltip content={t("notifications:inbox.title")}>
            <button
              ref={bellRef}
              onClick={() => setShowInbox((p) => !p)}
              className="relative w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-all [&>svg]:w-[18px] [&>svg]:h-[18px]"
            >
              {Icons.bell}
              {unreadCount > 0 && (
                <span className="absolute top-2.5 end-2.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </Tooltip>
          <NotificationsPopover
            open={showInbox}
            onClose={() => setShowInbox(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* New Meeting button */}
        <button
          onClick={() =>
            createRoom({
              name: t("dashboard:roomDefault", {
                name: user?.full_name || user?.username || "",
              }),
              max_participants: 20,
              is_recorded: false,
            })
          }
          disabled={roomLoading}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--brand-soft)] hover:opacity-95 text-[var(--brand-text)] font-bold text-xs cursor-pointer border-none transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            <path d="M8 9v6M5 12h6" />
          </svg>
          <span className="whitespace-nowrap">{isFarsi ? "جلسه جدید" : "New Meeting"}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="ms-0.5 opacity-80">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* User avatar */}
        <div
          onClick={() => navigate("/settings/profile")}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-soft)] to-[var(--brand)] flex items-center justify-center text-[var(--brand-text)] text-xs font-bold border-2 border-[var(--b)] hover:scale-105 transition-transform cursor-pointer flex-shrink-0"
        >
          {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
        </div>
      </div>

      <GlobalSearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </header>
  );
}
