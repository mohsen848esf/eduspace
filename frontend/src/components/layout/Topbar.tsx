import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { useNotificationsStore } from "../../features/auth/store/notificationsStore";
import { Icons } from "../../lib/constants/icons";
import { useLocale } from "../../i18n/useLocale";
import NotificationsPopover from "./NotificationsPopover";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgContextStore } from "../../features/auth/store/orgContextStore";
import GlobalSearchModal from "./GlobalSearchModal";
import { usePageHelp } from "../help/PageHelpProvider";
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

export default function Topbar({
  title,
  subtitle,
  isDark,
  onToggleTheme,
  showHamburger = false,
  onHamburgerClick,
}: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["dashboard", "common", "auth", "notifications"]);
  const { language, toggleLanguage } = useLocale();
  const { logout, user } = useAuthStore();
  const { orgContext, activeSlug, fetchOrgContext, setActiveSlug } = useOrgContextStore();
  const { triggerHelp } = usePageHelp();
  const { createRoom, isLoading: roomLoading } = useRoom();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setShowOrgDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOrgSwitch = async (slug: string) => {
    setShowOrgDropdown(false);
    setActiveSlug(slug);
    await fetchOrgContext(slug);
    queryClient.clear();
    navigate("/dashboard");
  };

  const hasMultipleOrgs = (user?.organizations?.length ?? 0) > 1;
  const activeOrgName = orgContext?.organization?.name ||
    user?.organizations?.find(o => o.slug === activeSlug)?.name ||
    activeSlug;

  const nextLanguageLabel =
    language === "en" ? t("common:language.persian") : t("common:language.english");

  const isFarsi = language === "fa";

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between gap-4 px-4 md:px-5 bg-[#16161f] border-b border-[rgba(255,255,255,0.08)] transition-colors duration-300">
      {/* Left section: Hamburger / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu")}>
            <button
              onClick={onHamburgerClick}
              aria-label={t("dashboard:nav.openMenu")}
              className="w-10 h-10 -ms-1 rounded-lg bg-transparent border-none cursor-pointer text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] flex items-center justify-center transition-colors duration-150 flex-shrink-0"
            >
              {Icons.menu}
            </button>
          </Tooltip>
        )}
        
        {/* Breadcrumbs */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#c7c4d7] font-medium select-none">
          <span>{isFarsi ? "مسیریاب" : "Breadcrumbs"}</span>
          <span className="text-[#464554]">&gt;</span>
          <span>{isFarsi ? "خانه" : "Home"}</span>
          <span className="text-[#464554]">&gt;</span>
          <span className="text-[#c0c1ff] font-semibold">{isFarsi ? "سامانه آموزشی" : "LMS"}</span>
        </div>

        {/* Separator if breadcrumbs not visible on smaller screens */}
        <div className="lg:hidden flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-white truncate">
            {title}
          </span>
        </div>
      </div>

      {/* Middle section: Search pill input */}
      <div className="hidden md:flex items-center relative max-w-[240px] w-full mx-auto">
        <span className="absolute start-3 text-[#c7c4d7] text-[11px]">🔍</span>
        <input
          type="text"
          placeholder={isFarsi ? "جستجوی دوره‌ها، فایل‌ها..." : "Search courses, docs..."}
          readOnly
          onClick={() => setShowSearchModal(true)}
          className="w-full bg-[#1e1e2a] border border-[rgba(255,255,255,0.1)] hover:border-[#6366f1] rounded-full py-1.5 ps-9 pe-4 text-xs cursor-pointer text-white focus:outline-none transition-all placeholder-[#908fa0]"
        />
      </div>

      {/* Right section: Actions, Search, Notifications, Help, New Meeting, Avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Tooltip content={t("common:language.switchTo", { language: nextLanguageLabel })}>
          <button
            onClick={toggleLanguage}
            className="px-2 h-8 rounded-lg bg-transparent border-none text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] cursor-pointer flex items-center justify-center text-xs font-semibold uppercase tracking-wider transition-all duration-150"
          >
            {language === "en" ? "EN" : "FA"}
          </button>
        </Tooltip>

        <Tooltip content={isDark ? t("topbar.switchToLight") : t("topbar.switchToDark")}>
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        {/* Search Icon */}
        <Tooltip content={t("topbar.search") + " (Ctrl+K)"}>
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] cursor-pointer flex items-center justify-center transition-all"
          >
            🔍
          </button>
        </Tooltip>

        {/* Notifications inbox with red dot */}
        <div className="relative">
          <Tooltip content={t("notifications:inbox.title")}>
            <button
              ref={bellRef}
              onClick={() => setShowInbox((p) => !p)}
              className="relative w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-transparent text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] transition-all [&>svg]:w-[18px] [&>svg]:h-[18px]"
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

        {/* Help question rounded square */}
        <Tooltip content={t("common:help.title", "Help & Tours")}>
          <button
            id="help-tour-button"
            onClick={triggerHelp}
            className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.1)] hover:border-[#6366f1] bg-transparent text-[#c7c4d7] hover:bg-[#1e1e2a] hover:text-[#e4e1ed] cursor-pointer flex items-center justify-center text-sm font-semibold transition-all"
          >
            ❓
          </button>
        </Tooltip>

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
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#c0c1ff] hover:bg-[#c0c1ff]/90 text-[#1000a9] font-bold text-xs cursor-pointer border-none transition-all active:scale-[0.98] disabled:opacity-50"
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
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold border-2 border-[#16161f] hover:scale-105 transition-transform cursor-pointer flex-shrink-0"
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
