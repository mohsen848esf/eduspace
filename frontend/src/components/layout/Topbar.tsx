import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { useOrgPermission } from "../../hooks/useOrgPermission";
import { useNotificationsStore } from "../../features/auth/store/notificationsStore";
import { useLocale } from "../../i18n/useLocale";
import NotificationsPopover from "./NotificationsPopover";
import { useRoom } from "../../features/room/hooks/useRoom";
import { usePageHelp } from "../help/PageHelpProvider";
import {
  HelpCircle,
  Bell,
  Video,
  LogOut,
  User,
  Moon,
  Sun,
  Globe,
  Plus,
  Menu,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface TopbarProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  showHamburger?: boolean;
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
  const { t } = useTranslation(["dashboard", "common", "auth", "notifications"]);
  const { language, toggleLanguage } = useLocale();
  const { user, logout } = useAuthStore();
  const { activeOrg } = useOrgPermission();
  const { createRoom, isLoading: roomLoading } = useRoom();
  const { triggerHelp } = usePageHelp();

  const [quickCode, setQuickCode] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const unreadCount = useNotificationsStore((s) =>
    s.items.filter((it) => it.readAt === null).length,
  );

  const isFarsi = language === "fa";

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickCode.trim().replace(/^.*\/room\//, "");
    if (cleaned) {
      navigate(`/room/${cleaned}`);
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate("/login");
  };

  const hasOrg = !!activeOrg;

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 bg-[var(--s1)] border-b border-[var(--b)] transition-colors select-none z-30">
      {/* 1. Start / Left: Brand or Page Title or Hamburger */}
      <div className="flex items-center gap-3 min-w-0">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu", { defaultValue: "منو" })}>
            <button
              type="button"
              onClick={onHamburgerClick}
              className="w-9 h-9 rounded-xl bg-transparent border border-[var(--b)] cursor-pointer text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
        )}

        {!hasOrg ? (
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 no-underline group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--brand)] to-blue-600 flex items-center justify-center text-white shadow-md shadow-[var(--brand)]/20 transition-transform group-hover:scale-105">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-[var(--t1)] tracking-tight">
                EduSpace
              </span>
              <span className="text-[10px] text-[var(--t3)] -mt-1 font-medium">
                {isFarsi ? "جلسات و کلاس‌های آنلاین" : "Smart Video Platform"}
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm md:text-base font-bold text-[var(--t1)] truncate">
              {title}
            </h1>
            {subtitle && (
              <span className="text-[11px] text-[var(--t3)] truncate hidden sm:inline">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Middle: Quick Room Join & New Meeting */}
      <div className="flex items-center gap-2 max-w-md w-full justify-center">
        <form
          onSubmit={handleJoinWithCode}
          className="hidden sm:flex items-center bg-[var(--s2)] border border-[var(--b)] rounded-full ps-3.5 pe-1 py-1 focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)] transition-all w-full max-w-[280px]"
        >
          <input
            type="text"
            value={quickCode}
            onChange={(e) => setQuickCode(e.target.value)}
            placeholder={isFarsi ? "کد یا لینک جلسه..." : "Enter code or link"}
            className="w-full bg-transparent border-none text-xs text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!quickCode.trim()}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer border-none",
              quickCode.trim()
                ? "bg-[var(--brand)] text-white hover:opacity-90 shadow-sm"
                : "bg-transparent text-[var(--t3)] opacity-60 cursor-not-allowed",
            )}
          >
            {isFarsi ? "پیوستن" : "Join"}
          </button>
        </form>

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
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:opacity-95 text-white font-bold text-xs cursor-pointer border-none shadow-md shadow-[var(--brand)]/20 transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap font-medium">
            {isFarsi ? "جلسه جدید" : "New Meeting"}
          </span>
        </button>
      </div>

      {/* 3. End / Right: Help, Notifications, Profile Avatar Dropdown */}
      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
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

        {/* Notifications Popover */}
        <div className="relative">
          <Tooltip content={t("notifications:inbox.title", { defaultValue: "صندوق پیام‌ها و اعلان‌ها" })}>
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

        {/* User Profile Avatar Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="User Profile"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--brand)] to-blue-700 text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--b)] hover:ring-2 hover:ring-[var(--brand)]/40 transition-all cursor-pointer shadow-sm"
          >
            {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
          </button>

          {showProfileMenu && (
            <div className="absolute end-0 top-full mt-2 w-64 bg-[var(--s1)] border border-[var(--b)] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Header */}
              <div className="p-3 bg-[var(--s2)] rounded-xl mb-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand)] text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">
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
    </header>
  );
}
