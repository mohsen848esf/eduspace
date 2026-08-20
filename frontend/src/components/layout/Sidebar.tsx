import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Tooltip } from "../ui/Tooltip";
import { useOrgPermission } from "../../hooks/useOrgPermission";
import { primaryNavItems, categoryNavItems, type NavItem } from "./navItems";
import { useAuthStore } from "../../features/auth/store/authStore";
import { Icons } from "../../lib/constants/icons";
import { useLocale } from "../../i18n/useLocale";
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
  const location = useLocation();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [collapsed] = useState(false);
  const { logout, user } = useAuthStore();
  const { activeRole, hasAnyPermission } = useOrgPermission();

  const queryClient = useQueryClient();
  const { activeSlug, fetchOrgContext, setActiveSlug } = useOrgContextStore();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Track expanded/collapsed state for categories
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categoryNavItems.forEach((cat) => {
      const hasActiveChild = cat.children?.some(
        (child) =>
          child.to &&
          (window.location.pathname === child.to ||
            (child.to !== "/dashboard" && window.location.pathname.startsWith(child.to)))
      );
      initial[cat.id] = hasActiveChild !== undefined ? hasActiveChild : true;
    });
    return initial;
  });

  // Auto-expand group when active child route changes
  useEffect(() => {
    categoryNavItems.forEach((cat) => {
      const hasActiveChild = cat.children?.some(
        (child) =>
          child.to &&
          (location.pathname === child.to ||
            (child.to !== "/dashboard" && location.pathname.startsWith(child.to)))
      );
      if (hasActiveChild) {
        setExpandedGroups((prev) => ({
          ...prev,
          [cat.id]: true,
        }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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
  const activeOrgRole = activeOrg?.role || activeRole || (isFarsi ? "عضو" : "Member");

  const filterNavItem = (item: NavItem): boolean => {
    if (item.permissions && !hasAnyPermission(item.permissions)) return false;
    if (item.roles) {
      const normActiveRole = (activeRole || "").toLowerCase();
      return item.roles.some((r) => r.toLowerCase() === normActiveRole);
    }
    return true;
  };

  // Filter categories and their visible children
  const visibleCategories = categoryNavItems
    .filter((cat) => {
      if (cat.permissions && !hasAnyPermission(cat.permissions)) return false;
      if (cat.roles) {
        const normActiveRole = (activeRole || "").toLowerCase();
        if (!cat.roles.some((r) => r.toLowerCase() === normActiveRole)) return false;
      }
      const visibleChildren = (cat.children || []).filter(filterNavItem);
      return visibleChildren.length > 0;
    })
    .map((cat) => ({
      ...cat,
      visibleChildren: (cat.children || []).filter(filterNavItem),
    }));

  const renderSingleNavButton = (item: NavItem, isSubItem = false) => {
    const targetTo = item.to || (item.id === "inbox" ? "/inbox" : undefined);
    const isActive = activeId === item.id || (targetTo ? location.pathname === targetTo || (targetTo !== "/dashboard" && location.pathname.startsWith(targetTo)) : false);
    const label = t(item.labelKey);

    const inner = (
      <>
        <span className={cn("w-5 h-5 flex items-center justify-center flex-shrink-0 text-base", isSubItem && "w-4 h-4 text-sm")}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className={cn("text-[13px] font-medium flex-1 whitespace-nowrap", isSubItem && "text-[12px]")}>
            {label}
          </span>
        )}
        {!collapsed && Boolean(item.badge) && (
          <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </>
    );

    const linkClasses = cn(
      "flex items-center gap-2.5 w-full rounded-xl transition-all duration-200 no-underline select-none",
      "text-start my-0.5",
      isSubItem ? "px-2.5 py-2 rounded-lg" : "px-3.5 py-2.5",
      collapsed && "justify-center px-2",
      isActive
        ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-sm"
        : "bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]"
    );

    const el = targetTo ? (
      <Link
        to={targetTo}
        onClick={() => onNavigate?.(item.id)}
        className={linkClasses}
      >
        {inner}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => onNavigate?.(item.id)}
        className={cn(linkClasses, "border-none cursor-pointer")}
      >
        {inner}
      </button>
    );

    return collapsed ? (
      <Tooltip
        key={item.id}
        content={item.badge ? `${label} · ${item.badge} new` : label}
        side="right"
      >
        {el}
      </Tooltip>
    ) : (
      <div key={item.id}>{el}</div>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full",
        "bg-[var(--s1)] border border-[var(--b)] rounded-2xl shadow-sm overflow-hidden",
        "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-14" : "w-[260px]",
      )}
    >
      {/* Logo / Org Header (Box 2) */}
      <div
        className={cn(
          "flex items-center h-18 px-4 border-b border-[var(--b)] flex-shrink-0 bg-[var(--s1)]",
          collapsed && "justify-center h-14 px-2",
        )}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 bg-[var(--brand)] rounded-xl flex items-center justify-center text-[#071712] font-black text-xl flex-shrink-0 shadow-md shadow-[var(--brand)]/20">
            {activeOrg ? (
              <span className="uppercase">{activeOrg.name.charAt(0)}</span>
            ) : (
              <span>J</span>
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-black text-white leading-snug truncate">
                {activeOrg ? activeOrg.name : "JobzLingo"}
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                {isFarsi ? "آکادمی" : "Academy"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <nav className="flex-1 p-2 flex flex-col overflow-y-auto pt-2 scrollbar-thin scrollbar-thumb-[var(--b)] gap-1">
        {/* 1. Primary Direct Links (Dashboard, Inbox) */}
        <div className="flex flex-col gap-0.5">
          {primaryNavItems
            .filter(filterNavItem)
            .map((item) => renderSingleNavButton(item))}
        </div>

        <div className="h-px w-full bg-[var(--b)] my-1.5" />

        {/* 2. Categorized Accordion Navigation */}
        <div className="flex flex-col gap-1">
          {visibleCategories.map((cat) => {
            const isGroupExpanded = !!expandedGroups[cat.id];
            const hasActiveChild = cat.visibleChildren.some(
              (c) =>
                c.to &&
                (location.pathname === c.to ||
                  (c.to !== "/dashboard" && location.pathname.startsWith(c.to)))
            );

            if (collapsed) {
              return (
                <Tooltip key={cat.id} content={t(cat.labelKey)} side="right">
                  <button
                    type="button"
                    onClick={() => {
                      if (cat.visibleChildren[0]?.to) {
                        navigate(cat.visibleChildren[0].to);
                      }
                    }}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border-none cursor-pointer mx-auto my-0.5",
                      hasActiveChild
                        ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-sm"
                        : "bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]"
                    )}
                  >
                    <span className="text-base">{cat.icon}</span>
                  </button>
                </Tooltip>
              );
            }

            return (
              <div key={cat.id} className="flex flex-col">
                {/* Category Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(cat.id)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all duration-150 border-none cursor-pointer select-none text-start my-0.5",
                    hasActiveChild
                      ? "text-[var(--brand-text)] font-bold bg-[var(--brand-soft)]/20"
                      : "text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] bg-transparent font-semibold"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("w-5 h-5 flex items-center justify-center flex-shrink-0 text-base", hasActiveChild ? "text-[var(--brand)]" : "text-[var(--t3)]")}>
                      {cat.icon}
                    </span>
                    <span className="text-[13px] truncate leading-tight">
                      {t(cat.labelKey)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[var(--t3)] transition-transform duration-200 flex-shrink-0 inline-flex items-center justify-center w-4 h-4",
                      isGroupExpanded ? "rotate-180" : "rotate-0"
                    )}
                  >
                    {Icons.chevronDown}
                  </span>
                </button>

                {/* Submenu Children */}
                {isGroupExpanded && (
                  <div className="flex flex-col ms-4 ps-2.5 my-0.5 border-s border-[var(--b)] gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {cat.visibleChildren.map((child) => {
                      const targetTo = child.to;
                      const isChildActive = targetTo
                        ? location.pathname === targetTo ||
                          (targetTo !== "/dashboard" && location.pathname.startsWith(targetTo))
                        : activeId === child.id;
                      const childLabel = t(child.labelKey);

                      const childClasses = cn(
                        "flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all duration-150 no-underline select-none text-start text-[12.5px]",
                        isChildActive
                          ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-xs ring-1 ring-[var(--brand)]/25"
                          : "bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)] font-medium"
                      );

                      const content = (
                        <>
                          <span className="truncate">{childLabel}</span>
                          {Boolean(child.badge) && (
                            <span className="bg-[var(--red)] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                              {child.badge}
                            </span>
                          )}
                        </>
                      );

                      if (targetTo) {
                        return (
                          <Link
                            key={child.id}
                            to={targetTo}
                            onClick={() => onNavigate?.(child.id)}
                            className={childClasses}
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onNavigate?.(child.id)}
                          className={cn(childClasses, "border-none cursor-pointer")}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 3. Platform Governance (Super Admin Isolated Context) */}
        {user?.is_superuser && (
          <div className="pt-2 mt-auto border-t border-[var(--b)]">
            {!collapsed && (
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider px-2 py-0.5 block">
                {isFarsi ? "حاکمیت پلتفرم" : "Platform Context"}
              </span>
            )}
            <Link
              to="/sys-admin"
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-all duration-200 no-underline select-none my-1",
                location.pathname.startsWith("/sys-admin")
                  ? "bg-indigo-600 text-white font-bold shadow-md"
                  : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 font-semibold border border-indigo-500/20",
                collapsed && "justify-center px-2"
              )}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-base">
                {Icons.tools}
              </span>
              {!collapsed && (
                <span className="text-[12px] truncate flex-1 font-bold">
                  {isFarsi ? "پنل حاکمیت سامانه" : "Platform Governance"}
                </span>
              )}
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom Organization & Actions Section (Box 3) */}
      <div className="p-3 border-t border-[var(--b)] flex flex-col gap-2 flex-shrink-0 relative" ref={switcherRef}>
        {!collapsed && (
          <div className="bg-[var(--s2)]/90 border border-[var(--b)] rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white truncate leading-tight">
                {activeOrg ? `${activeOrg.name} Academy` : "JobzLingo Academy"}
              </span>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                {activeOrgRole || (isFarsi ? "مدیریت سازمان" : "Organization Management")}
              </span>
            </div>

            {/* 4 Overlapping Avatars */}
            <div className="flex -space-x-2 rtl:space-x-reverse my-1">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--s2)] shadow-sm">
                {user?.username?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--s2)] shadow-sm">
                Z
              </div>
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--s2)] shadow-sm">
                R
              </div>
              <div className="w-6 h-6 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--s2)] shadow-sm">
                M
              </div>
            </div>

            {/* Switch Org Button */}
            <button
              type="button"
              onClick={() => setShowSwitcher((p) => !p)}
              className="w-full bg-[var(--s3)] hover:bg-[var(--brand-soft)] text-slate-200 hover:text-[var(--brand-text)] border border-[var(--b)] rounded-xl py-1.5 px-3 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 11l-5-5-5 5M17 13l-5 5-5-5" />
              </svg>
              <span>{isFarsi ? "تغییر سازمان" : "Switch Workspace"}</span>
            </button>
          </div>
        )}

        {/* Switcher Dropdown Popover */}
        {showSwitcher && (
          <div className="absolute bottom-full start-3 end-3 mb-2 bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-2 z-50 shadow-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                          <div className={cn("w-7.5 h-7.5 rounded-lg flex items-center justify-center text-white flex-shrink-0 font-bold", theme.bg)}>
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold truncate leading-tight">{org.name}</span>
                            <span className="text-[9px] text-[var(--t3)] capitalize mt-0.5">{org.role || (isFarsi ? "عضو" : "Member")}</span>
                          </div>
                        </div>
                        {isActive && (
                          <div className="w-5 h-5 rounded-full bg-[var(--brand-soft)] border border-[var(--brand)] text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-xs">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-start border-none cursor-pointer bg-transparent text-[var(--t2)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] transition-all",
              collapsed && "justify-center px-2",
            )}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {!collapsed && (
              <span className="text-[11px] font-medium">
                {isFarsi ? "خروج" : "Logout"}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

