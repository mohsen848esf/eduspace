import { useState } from "react";
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

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

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col overflow-y-auto pt-4 scrollbar-thin scrollbar-thumb-[var(--b)]">
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
