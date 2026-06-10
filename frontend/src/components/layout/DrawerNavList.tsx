import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Icons } from "../../lib/constants/icons";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../features/auth/store/authStore";
import {
  drawerNavItems,
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

      <DrawerBody>
        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-3 py-2">
          {t("dashboard:nav.manage")}
        </div>
        {(() => {
          const { hasPermission } = useOrgPermission();
          return drawerNavItems
            .filter((item) => !item.permission || hasPermission(item.permission))
            .map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
                    "text-start border-none cursor-pointer min-h-11",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                      : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
                  )}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className="text-sm font-medium flex-1">
                    {t(`dashboard:${item.labelKey}`)}
                  </span>
                  {item.badge && (
                    <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            });
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
