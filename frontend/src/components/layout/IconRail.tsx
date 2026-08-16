import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { cn } from "../../lib/utils";
import {
  mainNavItems,
  manageNavItems,
  type NavItem,
} from "./navItems";

import { useOrgPermission } from "../../hooks/useOrgPermission";
import { useAuthStore } from "../../features/auth/store/authStore";
import { Icons } from "../../lib/constants/icons";

import { Link } from "react-router-dom";

interface IconRailProps {
  activeId: string;
  onNavigate: (id: string) => void;
}

/**
 * Tablet-only collapsed sidebar (56px wide).
 *
 * Shows just icons with tooltips, no labels. Reuses the desktop sidebar's
 * navItems config so adding a destination there automatically lights up
 * here. Hidden below md and at lg+.
 */
export default function IconRail({ activeId, onNavigate }: IconRailProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuthStore();

  const renderItem = (item: NavItem) => {
    const isActive = activeId === item.id;
    const label = t(item.labelKey);

    const inner = (
      <>
        {item.icon}
        {Boolean(item.badge) && (
          <span className="absolute -top-1 -end-1 bg-[var(--red)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {item.badge}
          </span>
        )}
      </>
    );

    const itemClasses = cn(
      "w-10 h-10 rounded-lg no-underline",
      "flex items-center justify-center transition-colors duration-150",
      "relative select-none",
      isActive
        ? "bg-[var(--brand-soft)] text-[var(--brand-text)] font-bold shadow-sm"
        : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
    );

    const el = item.to ? (
      <Link
        key={item.id}
        to={item.to}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={itemClasses}
      >
        {inner}
      </Link>
    ) : (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={cn(itemClasses, "border-none cursor-pointer")}
      >
        {inner}
      </button>
    );

    return (
      <Tooltip key={item.id} content={label} side="right">
        {el}
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex lg:hidden",
        "flex-col items-center flex-shrink-0",
        "w-14 h-full",
        "bg-[var(--s1)] border-e border-[var(--b)]",
      )}
    >
      <div className="h-14 flex items-center justify-center flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[var(--brand)] flex items-center justify-center text-white text-sm font-bold">
          E
        </div>
      </div>
      <div className="h-px w-8 bg-[var(--b)] my-1" />

      {(() => {
        const { hasAnyPermission } = useOrgPermission();
        return (
          <nav className="flex flex-col gap-1 p-1 flex-1 overflow-y-auto">
            {mainNavItems
              .filter((item) => !item.permissions || hasAnyPermission(item.permissions))
              .map(renderItem)}
            <div className="h-px w-8 bg-[var(--b)] my-2 self-center" />
            {manageNavItems
              .filter((item) => !item.permissions || hasAnyPermission(item.permissions))
              .map(renderItem)}
            {user?.is_superuser && renderItem({
              id: "sysAdmin",
              icon: Icons.tools,
              labelKey: "nav.sysAdmin",
              to: "/sys-admin"
            })}
          </nav>
        );
      })()}
    </aside>
  );
}
