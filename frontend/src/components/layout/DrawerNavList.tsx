import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { Icons } from "../../lib/constants/icons";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../features/auth/store/authStore";
import {
  primaryNavItems,
  categoryNavItems,
  type NavItem,
} from "./navItems";
import {
  DrawerBody,
  DrawerClose,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./Drawer";
import { useOrgPermission } from "../../hooks/useOrgPermission";

interface DrawerNavListProps {
  /** Stable id of the currently active nav destination, if known. */
  activeId?: string;
  /** Called when a destination without a hard route is tapped. */
  onNavigate?: (id: string) => void;
  /** Called after any drawer interaction so AppShell can close it. */
  onClose: () => void;
}

/**
 * Body content for the mobile drawer. Renders the secondary navigation
 * (Students, Reports, Recordings, Settings) plus a sign-out row at the
 * bottom.
 *
 * Lives in its own file so the Drawer primitive stays generic and can
 * be reused later for things like a per-call participant drawer.
 */
export default function DrawerNavList({
  activeId,
  onNavigate,
  onClose,
}: DrawerNavListProps) {
  const { t } = useTranslation(["dashboard", "auth"]);
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { hasAnyPermission, activeRole } = useOrgPermission();

  const handleClick = (item: NavItem) => {
    if (item.to) {
      navigate(item.to);
    } else {
      onNavigate?.(item.id);
    }
    onClose();
  };

  const handleSignOut = async () => {
    await logout();
    onClose();
    navigate("/login");
  };

  return (
    <>
      <DrawerHeader>
        <div className="w-9 h-9 rounded-lg bg-[var(--brand)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          E
        </div>
        <div className="min-w-0 flex-1">
          <DrawerTitle>{t("dashboard:title")}</DrawerTitle>
          {user && (
            <div className="text-[11px] text-[var(--t3)] truncate">
              {user.full_name || user.username}
            </div>
          )}
        </div>
        <DrawerClose asChild>
          <button
            aria-label={t("dashboard:nav.closeMenu")}
            className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center text-lg"
          >
            ×
          </button>
        </DrawerClose>
      </DrawerHeader>

      <DrawerBody className="p-3 space-y-3">
        {(() => {
          const filterNavItem = (item: NavItem): boolean => {
            if (item.permissions && !hasAnyPermission(item.permissions)) return false;
            if (item.roles) {
              const normActiveRole = (activeRole || "").toLowerCase();
              return item.roles.some((r) => r.toLowerCase() === normActiveRole);
            }
            return true;
          };

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

          return (
            <div className="flex flex-col gap-2">
              {/* Primary links */}
              <div className="flex flex-col gap-1">
                {primaryNavItems.filter(filterNavItem).map((item) => {
                  const isActive = activeId === item.id;
                  const linkContent = (
                    <>
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="text-sm font-medium flex-1">
                        {t(`dashboard:${item.labelKey}`)}
                      </span>
                      {Boolean(item.badge) && (
                        <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  );

                  const itemClasses = cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl no-underline text-start min-h-11 transition-colors select-none",
                    isActive
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-sm"
                      : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
                  );

                  if (item.to) {
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={itemClasses}
                      >
                        {linkContent}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleClick(item)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(itemClasses, "border-none cursor-pointer")}
                    >
                      {linkContent}
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-[var(--b)] my-1" />

              {/* Categorized groups */}
              {visibleCategories.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider px-2 py-1 flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center text-xs text-[var(--brand)]">
                      {cat.icon}
                    </span>
                    <span>{t(`dashboard:${cat.labelKey}`)}</span>
                  </div>

                  <div className="flex flex-col ms-2 ps-2 border-s border-[var(--b)] gap-0.5">
                    {cat.visibleChildren.map((child) => {
                      const isActive = activeId === child.id;
                      const linkContent = (
                        <>
                          <span className="flex-shrink-0 w-4 h-4 text-xs flex items-center justify-center">
                            {child.icon}
                          </span>
                          <span className="text-xs font-medium flex-1">
                            {t(`dashboard:${child.labelKey}`)}
                          </span>
                          {Boolean(child.badge) && (
                            <span className="bg-[var(--red)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              {child.badge}
                            </span>
                          )}
                        </>
                      );

                      const itemClasses = cn(
                        "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg no-underline text-start min-h-9 transition-colors select-none",
                        isActive
                          ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-xs"
                          : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
                      );

                      if (child.to) {
                        return (
                          <Link
                            key={child.id}
                            to={child.to}
                            onClick={onClose}
                            aria-current={isActive ? "page" : undefined}
                            className={itemClasses}
                          >
                            {linkContent}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleClick(child)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(itemClasses, "border-none cursor-pointer")}
                        >
                          {linkContent}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Super Admin platform entry */}
              {user?.is_superuser && (
                <div className="pt-2 border-t border-[var(--b)] mt-2">
                  <Link
                    to="/sys-admin"
                    onClick={onClose}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl no-underline bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20"
                  >
                    <span>{Icons.tools}</span>
                    <span className="text-xs">{t("dashboard:nav.platformGovernance")}</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })()}
      </DrawerBody>

      <DrawerFooter>
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
            "text-start border-none cursor-pointer min-h-11",
            "transition-colors duration-150",
            "bg-transparent text-[var(--t2)]",
            "hover:bg-[var(--red)]/10 hover:text-[var(--red)]",
          )}
        >
          <span className="flex-shrink-0">{Icons.signOut}</span>
          <span className="text-sm font-medium flex-1">
            {t("dashboard:nav.signOut")}
          </span>
        </button>
      </DrawerFooter>
    </>
  );
}
