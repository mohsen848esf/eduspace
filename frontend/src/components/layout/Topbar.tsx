import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const queryClient = useQueryClient();
  const { t } = useTranslation(["dashboard", "common", "auth", "notifications"]);
  const { language, toggleLanguage } = useLocale();
  const { logout, user } = useAuthStore();
  const { orgContext, activeSlug, fetchOrgContext, setActiveSlug } = useOrgContextStore();
  
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

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

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between gap-2 px-4 md:px-5 bg-[var(--s1)] border-b border-[var(--b)] transition-colors duration-300">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu")}>
            <button
              onClick={onHamburgerClick}
              aria-label={t("dashboard:nav.openMenu")}
              className="w-10 h-10 -ms-1 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center transition-colors duration-150 flex-shrink-0"
            >
              {Icons.menu}
            </button>
          </Tooltip>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-semibold text-[var(--t1)] truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-[var(--t3)] truncate">
              {subtitle}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-[var(--b)] mx-2 flex-shrink-0" />

        {/* Org Switcher */}
        <div className="relative flex-shrink-0" ref={orgDropdownRef}>
          <button
            onClick={() => setShowOrgDropdown((p) => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--b)] text-xs text-[var(--t1)] transition-all duration-150 font-medium ${
              hasMultipleOrgs 
                ? "bg-[var(--s2)] hover:bg-[var(--s3)] cursor-pointer" 
                : "bg-[var(--s1)] cursor-default opacity-85"
            }`}
            disabled={!hasMultipleOrgs}
          >
            <span className="opacity-70">🏢</span>
            <span>{activeOrgName}</span>
            {hasMultipleOrgs && (
              <span className="text-[var(--t3)] transition-colors">
                {Icons.chevronDown}
              </span>
            )}
          </button>

          {showOrgDropdown && hasMultipleOrgs && (
            <div className="absolute top-full start-0 mt-1.5 w-56 rounded-lg bg-[var(--s1)] border border-[var(--b)] shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider border-b border-[var(--b)]">
                {t("common:organization.switch", "Switch Organization")}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {user?.organizations?.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleOrgSwitch(org.slug)}
                    className={`w-full px-3 py-2 text-start text-xs border-none cursor-pointer flex items-center justify-between transition-colors ${
                      org.slug === activeSlug
                        ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold"
                        : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
                    }`}
                  >
                    <span>{org.name}</span>
                    {org.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--s3)] text-[var(--t3)] scale-90 origin-right">
                        {org.role}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Tooltip
          content={t("common:language.switchTo", {
            language: nextLanguageLabel,
          })}
        >
          <button
            onClick={toggleLanguage}
            className="px-2 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-xs font-semibold uppercase tracking-wider transition-all duration-150"
          >
            {language === "en" ? "EN" : "FA"}
          </button>
        </Tooltip>

        <Tooltip
          content={
            isDark
              ? t("topbar.switchToLight")
              : t("topbar.switchToDark")
          }
        >
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        <Tooltip content={t("topbar.search") + " (Ctrl+K)"}>
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            🔍
          </button>
        </Tooltip>

        <div className="relative">
          <Tooltip
            content={
              unreadCount > 0
                ? t("notifications:inbox.unreadCount", { count: unreadCount })
                : t("notifications:inbox.title")
            }
          >
            <button
              ref={bellRef}
              onClick={() => setShowInbox((p) => !p)}
              aria-label={t("notifications:inbox.title")}
              aria-expanded={showInbox}
              className={cnBell(showInbox)}
            >
              {Icons.bell}
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 end-1 min-w-[14px] h-[14px] px-1 bg-[var(--red)] text-white text-[9px] font-bold rounded-full border-2 border-[var(--s1)] flex items-center justify-center force-ltr"
                  aria-hidden
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </Tooltip>
          <NotificationsPopover
            open={showInbox}
            onClose={() => setShowInbox(false)}
            anchorRef={bellRef}
          />
        </div>

        <Tooltip content={t("topbar.settings")}>
          <button
            onClick={() => navigate("/settings/profile")}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            ⚙️
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-[var(--b)] mx-1" />

        <Tooltip content={t("auth:signOutTooltip")}>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] flex items-center justify-center transition-all"
          >
            {Icons.leave}
          </button>
        </Tooltip>
      </div>

      <GlobalSearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </header>
  );
}

/**
 * Bell button class — its layout is reused in the popover-open state so
 * the active/inactive look stays consistent. Pulled out of the JSX to
 * keep the render tree readable.
 */
function cnBell(active: boolean): string {
  const base =
    "relative w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all duration-150 [&>svg]:w-[18px] [&>svg]:h-[18px]";
  return active
    ? `${base} bg-[var(--brand-soft)] text-[var(--brand-text)]`
    : `${base} bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]`;
}
