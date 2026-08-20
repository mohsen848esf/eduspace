import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { useOrgPermission } from "../../hooks/useOrgPermission";
import { useNotificationsStore } from "../../features/auth/store/notificationsStore";
import { useLocale } from "../../i18n/useLocale";
import NotificationsPopover from "./NotificationsPopover";
import GlobalSearchModal from "./GlobalSearchModal";
import { useRoom } from "../../features/room/hooks/useRoom";
import { usePageHelp } from "../help/PageHelpProvider";
import {
  GraduationCap,
  HelpCircle,
  Bell,
  LogOut,
  User,
  Moon,
  Sun,
  Globe,
  Plus,
  Menu,
  Search,
  LayoutGrid,
  ChevronDown,
  Building2,
} from "lucide-react";

interface TopbarProps {
  title?: string;
  subtitle?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  showHamburger?: boolean;
  onHamburgerClick?: () => void;
}

export default function Topbar({
  isDark,
  onToggleTheme,
  showHamburger = false,
  onHamburgerClick,
}: TopbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["dashboard", "common", "auth", "notifications"]);
  const { language, toggleLanguage } = useLocale();
  const { user, logout } = useAuthStore();
  const { activeOrg } = useOrgPermission();
  const { createRoom, isLoading: roomLoading } = useRoom();
  const { triggerHelp } = usePageHelp();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const unreadCount = useNotificationsStore((s) =>
    s.items.filter((it) => it.readAt === null).length,
  );

  const isFarsi = language === "fa";
  const orgDisplayName = activeOrg?.name || "JobzLingo";
  const orgInitial = orgDisplayName.charAt(0).toUpperCase();

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setShowOrgMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global search shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setShowSearchModal(true);
      return;
    }

    // If query looks like a room code or link, navigate to room directly
    const cleanedCode = query.replace(/^.*\/room\//, "");
    if (/^[a-zA-Z0-9_-]{3,}$/.test(cleanedCode)) {
      navigate(`/room/${cleanedCode}`);
      setSearchQuery("");
      return;
    }

    setShowSearchModal(true);
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 md:px-6 bg-[var(--s1)] border-b border-[var(--b)] transition-colors select-none z-30">
      {/* 1. Left: Brand Logo & New Meeting Button */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-shrink-0">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu", { defaultValue: "منو" })}>
            <button
              type="button"
              onClick={onHamburgerClick}
              className="w-9 h-9 rounded-xl bg-transparent border border-[var(--b)] cursor-pointer text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-colors flex-shrink-0 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
        )}

        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 no-underline group focus:outline-none flex-shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 transition-transform group-hover:scale-105 flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold text-[var(--t1)] tracking-tight leading-none">
              EduSpace
            </span>
            <span className="text-[10px] text-[var(--t3)] font-semibold mt-1 leading-none">
              Enterprise LMS
            </span>
          </div>
        </Link>

        {/* + جلسه جدید / New Meeting Button */}
        <button
          type="button"
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
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:opacity-90 text-white font-bold text-xs cursor-pointer border-none shadow-md shadow-[var(--brand)]/25 transition-all active:scale-[0.98] disabled:opacity-50 flex-shrink-0 ms-1"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="whitespace-nowrap font-extrabold">
            {isFarsi ? "جلسه جدید" : "New Meeting"}
          </span>
        </button>
      </div>

      {/* 2. Middle: Global Search Bar */}
      <div className="flex-1 max-w-sm md:max-w-md mx-2 flex justify-center">
        <form
          onSubmit={handleSearchSubmit}
          className="w-full flex items-center bg-[var(--s2)]/90 border border-[var(--b)] hover:border-[var(--brand)]/40 focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)] rounded-full px-3.5 py-1.5 transition-all shadow-sm"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isFarsi ? "جستجو در EduSpace..." : "Search EduSpace..."}
            className="w-full bg-transparent border-none text-xs text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none"
          />
          <button
            type="submit"
            className="text-[var(--t3)] hover:text-[var(--brand)] p-0.5 bg-transparent border-none cursor-pointer flex items-center justify-center ms-1.5 flex-shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 3. Right: Org Switcher, Mini-Apps, Notifications, Theme, Help, Profile Avatar */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Organization Switcher Dropdown Button */}
        <div className="relative" ref={orgRef}>
          <button
            type="button"
            onClick={() => setShowOrgMenu((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold transition-all cursor-pointer shadow-sm"
          >
            <div className="w-5 h-5 rounded-md bg-[var(--brand)] text-white text-[11px] font-black flex items-center justify-center shadow-sm flex-shrink-0">
              {orgInitial}
            </div>
            <span className="truncate max-w-[90px] hidden sm:inline font-bold">
              {orgDisplayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--t3)] flex-shrink-0" />
          </button>

          {showOrgMenu && (
            <div className="absolute end-0 top-full mt-2 w-56 bg-[var(--s1)] border border-[var(--b)] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 bg-[var(--s2)] rounded-xl mb-1.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white font-black flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                  {orgInitial}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate">
                    {orgDisplayName}
                  </span>
                  <span className="text-[10px] text-[var(--brand-text)] font-semibold truncate">
                    {isFarsi ? "سازمان فعال" : "Active Workspace"}
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <Link
                  to="/crm/org-settings"
                  onClick={() => setShowOrgMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)] rounded-lg transition-colors no-underline"
                >
                  <Building2 className="w-4 h-4 text-[var(--t3)]" />
                  <span>{isFarsi ? "تنظیمات سازمان" : "Organization Settings"}</span>
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setShowOrgMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)] rounded-lg transition-colors no-underline"
                >
                  <GraduationCap className="w-4 h-4 text-[var(--t3)]" />
                  <span>{isFarsi ? "داشبورد سازمان" : "Org Dashboard"}</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Mini Apps / Tools Grid Icon */}
        <Tooltip content={isFarsi ? "برنامه‌ها و ابزارها" : "Apps & Tools"}>
          <Link
            to="/miniapps"
            className="w-9 h-9 rounded-xl border border-transparent hover:border-[var(--b)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-all no-underline"
          >
            <LayoutGrid className="w-4 h-4" />
          </Link>
        </Tooltip>

        {/* Notifications Popover */}
        <div className="relative">
          <Tooltip content={t("notifications:inbox.title", { defaultValue: "اعلان‌ها" })}>
            <button
              ref={bellRef}
              type="button"
              onClick={() => setShowInbox((p) => !p)}
              className="relative w-9 h-9 rounded-xl border border-transparent hover:border-[var(--b)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 end-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--s1)] animate-pulse" />
              )}
            </button>
          </Tooltip>
          <NotificationsPopover
            open={showInbox}
            onClose={() => setShowInbox(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* Theme Toggle Button */}
        <Tooltip content={isDark ? (isFarsi ? "حالت روشن" : "Light Mode") : (isFarsi ? "حالت تاریک" : "Dark Mode")}>
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl border border-transparent hover:border-[var(--b)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-all cursor-pointer"
          >
            {isDark ? (
              <Moon className="w-4 h-4 text-indigo-300 hover:text-indigo-200" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 hover:text-amber-400" />
            )}
          </button>
        </Tooltip>

        {/* Help Button */}
        <Tooltip content={isFarsi ? "راهنما و پشتیبانی" : "Help & Guides"}>
          <button
            type="button"
            onClick={triggerHelp}
            aria-label="Help"
            className="w-9 h-9 rounded-xl border border-transparent hover:border-[var(--b)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* User Profile Avatar Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="User Profile"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[var(--brand)] to-emerald-700 text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--b)] hover:ring-2 hover:ring-[var(--brand)]/40 transition-all cursor-pointer shadow-sm overflow-hidden"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute end-0 top-full mt-2 w-64 bg-[var(--s1)] border border-[var(--b)] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Header */}
              <div className="p-3 bg-[var(--s2)] rounded-xl mb-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                  {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate">
                    {user?.full_name || user?.username || "User"}
                  </span>
                  <span className="text-[10px] text-[var(--t3)] truncate">
                    {user?.email || ""}
                  </span>
                  <span className="mt-1 inline-flex items-center text-[9px] font-semibold text-[var(--brand-text)] bg-[var(--brand-soft)] px-1.5 py-0.5 rounded w-fit">
                    {activeOrg ? activeOrg.name : (isFarsi ? "کاربر شخصی" : "Personal")}
                  </span>
                </div>
              </div>

              {/* Profile Menu Actions */}
              <div className="space-y-0.5">
                <Link
                  to="/settings/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)] rounded-lg transition-colors no-underline"
                >
                  <User className="w-4 h-4 text-[var(--t3)]" />
                  <span>{isFarsi ? "حساب کاربری و پروفایل" : "Account Profile"}</span>
                </Link>

                {/* Theme Switcher Toggle */}
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)] rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                    <span>{isFarsi ? "حالت تاریک" : "Dark Mode"}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--s3)] font-semibold text-[var(--t2)]">
                    {isDark ? (isFarsi ? "روشن" : "On") : (isFarsi ? "خاموش" : "Off")}
                  </span>
                </button>

                {/* Language Switcher Toggle */}
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)] rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-[var(--t3)]" />
                    <span>{isFarsi ? "زبان برنامه" : "Language"}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--s3)] font-semibold text-[var(--brand-text)]">
                    {language === "fa" ? "فارسی (FA)" : "English (EN)"}
                  </span>
                </button>
              </div>

              {/* Logout Button */}
              <div className="mt-1 pt-1 border-t border-[var(--b)]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[var(--red)] hover:bg-[var(--red)]/10 rounded-lg transition-colors border-none bg-transparent cursor-pointer text-start"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isFarsi ? "خروج از حساب کاربری" : "Sign Out"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <GlobalSearchModal open={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </header>
  );
}
