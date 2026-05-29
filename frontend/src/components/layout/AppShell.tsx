import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { cn } from "../../lib/utils";

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
  recordings: "/recordings",
};

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
      <Sidebar activeId={resolvedActive} onNavigate={handleNavigate} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
