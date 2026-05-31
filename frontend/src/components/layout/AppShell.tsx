import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import IconRail from "./IconRail";
import BottomNav from "./BottomNav";
import { Drawer } from "./Drawer";
import DrawerNavList from "./DrawerNavList";
import { cn } from "../../lib/utils";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useShellStore } from "../../store/shellStore";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

// Sidebar nav id -> route. Only ids that have a real page get a route.
// Unmapped ids fall back to the parent's onNavigate if provided.
const NAV_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  // No dedicated calls page yet — the dashboard hosts the Start Call
  // quick action, so the calls nav entry lands there until the Calls
  // page lands as part of the dashboard redesign.
  calls: "/dashboard",
  recordings: "/recordings",
  miniapps: "/miniapps",
};

/**
 * Authenticated app shell. Renders three different chrome variants
 * depending on viewport:
 *
 *   desktop (>= 1024px) — full Sidebar (224px) + Topbar
 *   tablet  (768–1023)  — collapsed IconRail (56px) + Topbar
 *   mobile  (< 768px)   — Topbar (with hamburger) + BottomNav + Drawer
 *
 * Pages don't need to know which variant is active; they just pass their
 * title / subtitle / activeNav as before. The layout primitives all read
 * from the same `navItems` config so a destination added there shows up
 * everywhere.
 */
export default function AppShell({
  children,
  title,
  subtitle,
  activeNav,
  onNavigate,
}: AppShellProps) {
  const [isDark, setIsDark] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const breakpoint = useBreakpoint();
  const drawerOpen = useShellStore((s) => s.drawerOpen);
  const setDrawerOpen = useShellStore((s) => s.setDrawerOpen);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Fall back to route-based active id when the page didn't pin one.
  const resolvedActive =
    activeNav ??
    Object.entries(NAV_ROUTES).find(([, path]) =>
      location.pathname.startsWith(path),
    )?.[0] ??
    "dashboard";

  const handleNavigate = (id: string) => {
    const route = NAV_ROUTES[id];
    if (route) {
      navigate(route);
      return;
    }
    onNavigate?.(id);
  };

  return (
    <div
      className={cn(
        "flex w-full h-full",
        "bg-[var(--s0)] text-[var(--t1)]",
        "transition-colors duration-300",
      )}
    >
      {breakpoint === "desktop" && (
        <Sidebar activeId={resolvedActive} onNavigate={handleNavigate} />
      )}
      {breakpoint === "tablet" && (
        <IconRail activeId={resolvedActive} onNavigate={handleNavigate} />
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          showHamburger={breakpoint === "mobile"}
          onHamburgerClick={() => setDrawerOpen(true)}
        />
        <main
          className={cn(
            "flex-1 overflow-y-auto p-4 md:p-5",
            // Bottom padding clears the fixed BottomNav on mobile.
            breakpoint === "mobile" && "pb-20",
          )}
        >
          {children}
        </main>
        {breakpoint === "mobile" && (
          <BottomNav
            activeId={resolvedActive}
            onMoreClick={() => setDrawerOpen(true)}
          />
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="start"
        ariaLabel="Navigation"
      >
        <DrawerNavList
          activeId={resolvedActive}
          onNavigate={handleNavigate}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
