import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Icons } from "../../lib/constants/icons";
import { cn } from "../../lib/utils";
import { bottomNavPrimary, type NavItem } from "./navItems";

interface BottomNavProps {
  /** Stable id of the currently selected item, or "more" when the drawer is open. */
  activeId?: string;
  /** Called when the More button is pressed; AppShell uses this to open the drawer. */
  onMoreClick: () => void;
  /** Optional override for the items list (used by tests / specialized shells). */
  items?: NavItem[];
}

/**
 * Mobile-only bottom navigation bar.
 *
 * Renders the four primary destinations plus a "More" button that hands
 * off to the parent (typically opens the drawer). Hidden at md and above.
 *
 * Active state is read from the current route when no explicit activeId
 * is provided — that way pages that already pass an activeNav into
 * AppShell don't need extra wiring.
 */
export default function BottomNav({
  activeId,
  onMoreClick,
  items = bottomNavPrimary,
}: BottomNavProps) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const location = useLocation();

  const resolvedActive =
    activeId ??
    items.find((item) => item.to && location.pathname.startsWith(item.to))?.id ??
    "";

  return (
    <nav
      className={cn(
        "md:hidden flex-shrink-0",
        // Bottom inset for iOS home-indicator. env(safe-area-inset-bottom)
        // expands the padding only on devices that need it.
        "h-16 pb-[env(safe-area-inset-bottom)]",
        "bg-[var(--s1)] border-t border-[var(--b)]",
        "grid grid-cols-5",
      )}
      role="navigation"
      aria-label={t("nav.main")}
    >
      {items.map((item) => {
        const isActive = item.id === resolvedActive;
        return (
          <button
            key={item.id}
            onClick={() => item.to && navigate(item.to)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-h-11",
              "border-none bg-transparent cursor-pointer",
              "transition-colors duration-150",
              isActive
                ? "text-[var(--brand-text)]"
                : "text-[var(--t3)] hover:text-[var(--t1)]",
            )}
          >
            <span className="leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium leading-none">
              {t(item.labelKey)}
            </span>
          </button>
        );
      })}

      <button
        onClick={onMoreClick}
        aria-label={t("nav.more")}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 min-h-11",
          "border-none bg-transparent cursor-pointer",
          "transition-colors duration-150",
          activeId === "more"
            ? "text-[var(--brand-text)]"
            : "text-[var(--t3)] hover:text-[var(--t1)]",
        )}
      >
        <span className="leading-none">{Icons.more}</span>
        <span className="text-[10px] font-medium leading-none">
          {t("nav.more")}
        </span>
      </button>
    </nav>
  );
}
