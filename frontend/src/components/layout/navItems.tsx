import { Icons } from "../../lib/constants/icons";

/**
 * Single source of truth for the authenticated app's navigation items.
 *
 * Used by:
 *   - Sidebar    (desktop, full labels)
 *   - IconRail   (tablet, icons + tooltips)
 *   - BottomNav  (mobile, 5 primary items + "More")
 *   - Drawer     (mobile, secondary items + sign out)
 *
 * Each item references an i18n key under `dashboard:nav.*` so labels stay
 * in sync across surfaces. Routes that don't exist yet (games, exams,
 * etc.) carry a `to` value so the routing decision lives here, even if
 * those pages haven't been built — clicking them today is a no-op handled
 * by AppShell's onNavigate fallback.
 */
export interface NavItem {
  /** Stable id used for active highlighting and as React key. */
  id: string;
  /** SVG icon node (uses currentColor). */
  icon: React.ReactNode;
  /** i18n key under the `dashboard` namespace, e.g. "nav.dashboard". */
  labelKey: string;
  /** Optional route — when set, AppShell navigates here on click. */
  to?: string;
  /** Optional unread / counter badge (small red pill). */
  badge?: number;
}

/** Items rendered in the desktop sidebar's MAIN section + tablet rail. */
export const mainNavItems: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "calls", icon: Icons.camera, labelKey: "nav.videoCalls" },
  // Renamed: Games → Mini Apps. The id stays `games` so existing
  // active-id state and analytics keep working; only the label and
  // route change. The destination page is now a gallery of all
  // embeddable apps (games, whiteboards, polls, exams) — see
  // `/miniapps` route in routes.tsx.
  { id: "miniapps", icon: Icons.game, labelKey: "nav.miniApps", to: "/miniapps" },
  { id: "exams", icon: Icons.exam, labelKey: "nav.exams" },
];

/** Items rendered in the desktop sidebar's MANAGE section + drawer. */
export const manageNavItems: NavItem[] = [
  { id: "students", icon: Icons.people, labelKey: "nav.students", badge: 3 },
  { id: "reports", icon: Icons.barChart, labelKey: "nav.reports" },
  { id: "recordings", icon: Icons.film, labelKey: "nav.recordings", to: "/recordings" },
];

/**
 * The 4 primary items shown on mobile's bottom nav. The 5th slot is the
 * "More" button which opens the drawer; it's not a NavItem because its
 * action is bespoke.
 */
export const bottomNavPrimary: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "calls", icon: Icons.camera, labelKey: "nav.videoCalls" },
  { id: "miniapps", icon: Icons.game, labelKey: "nav.miniApps", to: "/miniapps" },
  { id: "exams", icon: Icons.exam, labelKey: "nav.exams" },
];

/**
 * Items shown inside the drawer that opens from the mobile topbar's
 * hamburger or the bottom-nav "More" button. Combines the desktop's
 * MANAGE list plus a dedicated Sign-out row that the layout handles.
 */
export const drawerNavItems: NavItem[] = [...manageNavItems];
