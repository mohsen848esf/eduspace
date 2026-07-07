import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Tooltip } from "../ui/Tooltip";
import { useOrgPermission } from "../../hooks/useOrgPermission";
import { mainNavItems, manageNavItems, type NavItem } from "./navItems";
import { useAuthStore } from "../../features/auth/store/authStore";
import { Icons } from "../../lib/constants/icons";
import { useLocale } from "../../i18n/useLocale";
import { usePageHelp } from "../help/PageHelpProvider";
import { useOrgContextStore } from "../../features/auth/store/orgContextStore";
import { useQueryClient } from "@tanstack/react-query";

interface SidebarProps {
  activeId?: string;
  onNavigate?: (id: string) => void;
}

export default function Sidebar({
  activeId = "dashboard",
  onNavigate,
}: SidebarProps) {
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const { triggerHelp } = usePageHelp();
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuthStore();
  const { activeRole, hasAnyPermission } = useOrgPermission();

  const queryClient = useQueryClient();
  const { orgContext, activeSlug, fetchOrgContext, setActiveSlug } = useOrgContextStore();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowSwitcher(false);
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
    setShowSwitcher(false);
    setActiveSlug(slug);
    await fetchOrgContext(slug);
    queryClient.clear();
    navigate("/dashboard");
  };

  const getOrgTheme = (index: number) => {
    const themes = [
      {
        bg: "bg-orange-600",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4.5 16.5c-1.5 1.26-2 2.5-2 2.5s1.24-.5 2.5-2M15 9l-6 6M9 9l6 6M19 5l-4.5 4.5M19 5c-1-1-3-1-4.5.5L4 16l4 4 10.5-10.5c1.5-1.5 1.5-3.5.5-4.5z" />
          </svg>
        ),
      },
      {
        bg: "bg-indigo-600",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
      },
      {
        bg: "bg-slate-600",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 6.17157 22 7 22H12Z" />
            <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
            <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor" />
            <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="15.5" cy="14.5" r="1.2" fill="currentColor" />
          </svg>
        ),
      },
    ];
    return themes[index % themes.length];
  };

  const activeOrg = user?.organizations?.find((o) => o.slug === activeSlug);
  const activeOrgIndex = user?.organizations?.findIndex((o) => o.slug === activeSlug) ?? 0;
  const activeOrgRole = activeOrg?.role || activeRole || (isFarsi ? "عضو" : "Member");
  const activeTheme = getOrgTheme(activeOrgIndex >= 0 ? activeOrgIndex : 0);

  const canManage = hasAnyPermission(["can_manage_members"]) || activeOrgRole?.toLowerCase() === "owner" || activeOrgRole?.toLowerCase() === "admin";

  const filterNavItem = (item: NavItem) => {
    if (item.permissions && !hasAnyPermission(item.permissions)) return false;
    if (item.roles) {
      const normActiveRole = (activeRole || "").toLowerCase();
      return item.roles.some((r) => r.toLowerCase() === normActiveRole);
    }
    return true;
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = activeId === item.id;
    const label = t(item.labelKey);
    const btn = (
      <button
        onClick={() => onNavigate?.(item.id)}
        className={cn(
          "flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl transition-all duration-200",
          "text-start border-none cursor-pointer my-0.5",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-sm"
            : "bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]",
        )}
      >
        <span className="text-base w-5 h-5 flex items-center justify-center flex-shrink-0">
          {item.icon}
        </span>
        {!collapsed && (
          <span className="text-[13px] font-medium flex-1 whitespace-nowrap">
            {label}
          </span>
        )}
        {!collapsed && item.badge && (
          <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </button>
    );

    return collapsed ? (
      <Tooltip
        content={item.badge ? `${label} · ${item.badge} new` : label}
        side="right"
      >
        {btn}
      </Tooltip>
    ) : (
      btn
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full",
        "bg-[var(--s1)] border-e border-[var(--b)]",
        "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-[var(--b)] flex-shrink-0",
          collapsed && "justify-center",
        )}
      >
        <Tooltip
          content={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          side="right"
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-3 cursor-pointer bg-transparent border-none p-0 w-full text-start",
              collapsed && "justify-center",
            )}
          >
            <div className="w-9 h-9 bg-[var(--brand)] rounded-[10px] flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-md">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-[var(--t1)] leading-tight">
                  EduSpace
                </span>
                <span className="text-[10px] text-[var(--t3)]">
                  Enterprise LMS
                </span>
              </div>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Workspace Switcher Panel */}
      {!collapsed && (
        <div ref={switcherRef} className="px-3 pt-4 pb-2 flex flex-col gap-1.5 flex-shrink-0 select-none relative">
          <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider px-1">
            {isFarsi ? "فضای کاری فعلی" : "Current Workspace"}
          </span>
          <button
            onClick={() => setShowSwitcher((p) => !p)}
            className="w-full flex items-center justify-between gap-3 p-3 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl cursor-pointer transition-all duration-200 text-start"
          >
            {activeOrg ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm", activeTheme.bg)}>
                  {activeTheme.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate leading-snug">{activeOrg.name}</span>
                  <span className="text-[10px] text-[var(--t3)] capitalize mt-0.5">{activeOrgRole}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[var(--t3)] flex-shrink-0">
                  🏢
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] leading-snug">{isFarsi ? "انتخاب فضای کاری" : "Select Workspace"}</span>
                  <span className="text-[10px] text-[var(--t3)] mt-0.5">{isFarsi ? "بدون سازمان" : "No active org"}</span>
                </div>
              </div>
            )}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--t3)] flex-shrink-0">
              <path d="M17 11l-5-5-5 5M17 13l-5 5-5-5" />
            </svg>
          </button>

          {/* Switcher Dropdown Popover */}
          {showSwitcher && (
            <div className="absolute top-[calc(100%-4px)] start-3 end-3 mt-1 bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-2 z-50 shadow-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* CURRENT WORKSPACES */}
              {user?.organizations && user.organizations.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wider px-2 py-1">
                    {isFarsi ? "فضاهای کاری من" : "Current Workspaces"}
                  </span>
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 scrollbar-thin scrollbar-thumb-[var(--b)]">
                    {user.organizations.map((org, index) => {
                      const isActive = org.slug === activeSlug;
                      const theme = getOrgTheme(index);
                      return (
                        <button
                          key={org.id}
                          onClick={() => handleOrgSwitch(org.slug)}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 p-2 rounded-xl border-none cursor-pointer text-start transition-colors",
                            isActive
                              ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold"
                              : "bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn("w-7.5 h-7.5 rounded-lg flex items-center justify-center text-white flex-shrink-0", theme.bg)}>
                              {theme.icon}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold truncate leading-tight">{org.name}</span>
                              <span className="text-[9px] text-[var(--t3)] capitalize mt-0.5">{org.role || (isFarsi ? "عضو" : "Member")}</span>
                            </div>
                          </div>
                          {isActive && (
                            <div className="w-5 h-5 rounded-full bg-[var(--brand-soft)] border border-[var(--brand)] text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MANAGEMENT */}
              {activeOrg && canManage && (
                <div className="flex flex-col gap-0.5 border-t border-[var(--b)] pt-1.5 mt-0.5">
                  <span className="text-[9px] font-bold text-[var(--t3)] uppercase tracking-wider px-2 py-1">
                    {isFarsi ? "مدیریت سازمان" : "Management"}
                  </span>
                  
                  {/* Invite Members */}
                  <button
                    onClick={() => {
                      setShowSwitcher(false);
                      navigate("/crm/members");
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-transparent border-none cursor-pointer text-start text-[11px] font-medium text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="17" y1="11" x2="23" y2="11" />
                    </svg>
                    <span>{isFarsi ? "دعوت از اعضا" : "Invite Members"}</span>
                  </button>

                  {/* Organization Settings */}
                  <button
                    onClick={() => {
                      setShowSwitcher(false);
                      navigate("/settings/organization");
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-transparent border-none cursor-pointer text-start text-[11px] font-medium text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>{isFarsi ? "تنظیمات سازمان" : "Organization Settings"}</span>
                  </button>

                  {/* Billing */}
                  <button
                    onClick={() => {
                      setShowSwitcher(false);
                      navigate("/settings/billing");
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-transparent border-none cursor-pointer text-start text-[11px] font-medium text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                      <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    <span>{isFarsi ? "امور مالی و اشتراک" : "Billing"}</span>
                  </button>
                </div>
              )}

              {/* CREATE & JOIN */}
              <div className="flex flex-col gap-0.5 border-t border-[var(--b)] pt-1.5 mt-0.5">
                {/* Create Org */}
                <button
                  onClick={() => {
                    setShowSwitcher(false);
                    navigate("/dashboard?action=create-org");
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-transparent border-none cursor-pointer text-start text-[11px] font-medium text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-[var(--brand)]">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span>{isFarsi ? "ایجاد سازمان جدید" : "Create Organization"}</span>
                </button>

                {/* Join Org */}
                <button
                  onClick={() => {
                    setShowSwitcher(false);
                    navigate("/dashboard?action=join-org");
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-transparent border-none cursor-pointer text-start text-[11px] font-medium text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-[var(--t3)]">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  <span>{isFarsi ? "پیوستن به سازمان" : "Join Organization"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col overflow-y-auto pt-2 scrollbar-thin scrollbar-thumb-[var(--b)]">
        {!collapsed && (
          <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-[0.8px] px-3.5 py-1.5">
            {t("nav.main")}
          </span>
        )}
        {mainNavItems
          .filter(filterNavItem)
          .map((item) => (
            <NavButton key={item.id} item={item} />
          ))}

        {!collapsed && (
          <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-[0.8px] px-3.5 py-1.5 mt-3">
            {t("nav.manage")}
          </span>
        )}
        {manageNavItems
          .filter(filterNavItem)
          .map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        {user?.is_superuser && (
          <NavButton
            key="sysAdmin"
            item={{
              id: "sysAdmin",
              icon: Icons.tools,
              labelKey: "nav.sysAdmin",
              to: "/sys-admin",
            }}
          />
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-[var(--b)] flex flex-col gap-1">
        {/* Help */}
        <button
          onClick={triggerHelp}
          className={cn(
            "flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-start border-none cursor-pointer bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] transition-all",
            collapsed && "justify-center px-2",
          )}
        >
          <span className="text-base w-5 h-5 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          {!collapsed && (
            <span className="text-[13px] font-medium">
              {isFarsi ? "راهنما" : "Help"}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-start border-none cursor-pointer bg-transparent text-[var(--t2)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] transition-all",
            collapsed && "justify-center px-2",
          )}
        >
          <span className="text-base w-5 h-5 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </span>
          {!collapsed && (
            <span className="text-[13px] font-medium">
              {isFarsi ? "خروج" : "Logout"}
            </span>
          )}
        </button>

        {/* Support Center Capsule */}
        {!collapsed && (
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-[var(--s2)] text-[var(--t2)] border border-[var(--b)] transition-all font-semibold rounded-xl text-center py-2 px-4 text-xs mt-3 flex items-center justify-center cursor-pointer whitespace-nowrap hover:bg-[var(--s3)] hover:text-[var(--t1)]"
          >
            {isFarsi ? "مرکز پشتیبانی" : "Support Center"}
          </button>
        )}
      </div>
    </aside>
  );
}
