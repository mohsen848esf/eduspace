import { useLocation, useNavigate, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import IconRail from "./IconRail";
import BottomNav from "./BottomNav";
import { Drawer } from "./Drawer";
import DrawerNavList from "./DrawerNavList";
import { cn } from "../../lib/utils";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useShellStore } from "../../store/shellStore";
import { useOrgContextStore } from "../../features/auth/store/orgContextStore";
import { useLocale } from "../../i18n/useLocale";
import { AlertTriangle } from "lucide-react";
import { PageHelpProvider } from "../help/PageHelpProvider";


import SubTopbar from "./SubTopbar";
import { useOrgPermission } from "../../hooks/useOrgPermission";

import { useThemeStore } from "../../store/themeStore";

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
  inbox: "/inbox",
  notifications: "/inbox",
  courses: "/academic/courses",
  classes: "/academic/classes",
  sessions: "/academic/sessions",
  attendance: "/academic/attendance",
  homework: "/academic/homework",
  payments: "/academic/payments",
  reports: "/academic/reports",
  members: "/crm/members",
  ledger: "/finance/ledger",
  organization: "/settings/organization",
  billing: "/settings/billing",
  templates: "/settings/templates",
  profile: "/settings/profile",
  notificationsSettings: "/settings/notifications",
  miniapps: "/miniapps",
  leaderboard: "/leaderboard",
  sysAdmin: "/sys-admin",
};

/**
 * Authenticated app shell. Renders chrome variants depending on viewport
 * and organization state.
 */
export default function AppShell({
  children,
  title,
  subtitle,
  activeNav,
  onNavigate,
}: AppShellProps) {
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const location = useLocation();
  const breakpoint = useBreakpoint();
  const drawerOpen = useShellStore((s) => s.drawerOpen);
  const setDrawerOpen = useShellStore((s) => s.setDrawerOpen);
  const { activeOrg } = useOrgPermission();
  const hasOrg = !!activeOrg;

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

  const { orgContext } = useOrgContextStore();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const isSuspended = orgContext?.organization?.is_suspended;

  return (
    <PageHelpProvider>
      <div
        className={cn(
          "flex flex-col w-full h-full min-h-screen",
          "bg-[var(--s0)] text-[var(--t1)]",
          "transition-colors duration-300 overflow-hidden",
        )}
      >
        {/* Full-Width Topbar Header spanning 100% width across top */}
        <Topbar
          title={title}
          subtitle={subtitle}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          showHamburger={hasOrg && breakpoint === "mobile"}
          onHamburgerClick={() => setDrawerOpen(true)}
        />

        {/* Content body with Sidebar + Main View */}
        <div className="flex flex-1 w-full min-h-0 overflow-hidden p-2.5 sm:p-3 gap-3">
          {hasOrg && breakpoint === "desktop" && (
            <Sidebar activeId={resolvedActive} onNavigate={handleNavigate} />
          )}
          {hasOrg && breakpoint === "tablet" && (
            <IconRail activeId={resolvedActive} onNavigate={handleNavigate} />
          )}

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden rounded-2xl bg-[var(--s0)]">
            {hasOrg && location.pathname !== "/dashboard" && <SubTopbar />}
            {isSuspended && (
              <div 
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  borderBottom: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "var(--red)",
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  backdropFilter: "blur(4px)",
                  flexShrink: 0,
                }}
                className="no-print"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                  <span>
                    {isFarsi
                      ? "دسترسی سازمان به دلیل فاکتورهای پرداخت‌نشده معلق شده است. برای فعال‌سازی مجدد لطفاً فاکتورهای معوقه را پرداخت کنید."
                      : "Your organization suspension is active due to overdue/unpaid invoices. Please resolve billing to restore full service."}
                  </span>
                </div>
                <Link
                  to="/settings/billing"
                  style={{
                    fontWeight: "bold",
                    textDecoration: "underline",
                    color: "var(--brand-text)",
                    whiteSpace: "nowrap",
                    marginLeft: isFarsi ? "0" : "auto",
                    marginRight: isFarsi ? "auto" : "0",
                  }}
                >
                  {isFarsi ? "پرداخت و مدیریت اشتراک" : "Manage Billing & Subscription"} &rarr;
                </Link>
              </div>
            )}
            <main
              className={cn(
                "flex-1 overflow-y-auto p-4 md:p-5",
                // Bottom padding clears the fixed BottomNav on mobile.
                breakpoint === "mobile" && "pb-20",
              )}
            >
              {children}
            </main>
            {hasOrg && breakpoint === "mobile" && (
              <BottomNav
                activeId={resolvedActive}
                onMoreClick={() => setDrawerOpen(true)}
              />
            )}
          </div>
        </div>

        {hasOrg && (
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
        )}
      </div>
    </PageHelpProvider>
  );
}

