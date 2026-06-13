import { Icons } from "../../lib/constants/icons";

/**
 * Single source of truth for the authenticated app's navigation items.
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
  /** Optional required permissions list to view this nav item (uses hasAnyPermission). */
  permissions?: string[];
}

/** Items rendered in the desktop sidebar's MAIN section + tablet rail. */
export const mainNavItems: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "courses", icon: Icons.exam, labelKey: "nav.courses", to: "/academic/courses", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "classes", icon: Icons.people, labelKey: "nav.classes", to: "/academic/classes", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "sessions", icon: Icons.camera, labelKey: "nav.sessions", to: "/academic/sessions", permissions: ["can_view_sessions"] },
  { id: "assessments", icon: Icons.tools, labelKey: "nav.assessments", to: "/academic/assessments", permissions: ["can_view_dashboard"] },
];

/** Items rendered in the desktop sidebar's MANAGE section + drawer. */
export const manageNavItems: NavItem[] = [
  { id: "members", icon: Icons.people, labelKey: "nav.members", to: "/crm/members", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "ledger", icon: Icons.barChart, labelKey: "nav.ledger", to: "/finance/ledger", permissions: ["can_view_financials"] },
  { id: "recordings", icon: Icons.film, labelKey: "nav.recordings", to: "/recordings", permissions: ["can_view_dashboard"] },
  { id: "organization", icon: Icons.settings, labelKey: "nav.orgSettings", to: "/settings/organization", permissions: ["can_manage_members"] },
];

/**
 * The 4 primary items shown on mobile's bottom nav. The 5th slot is the
 * "More" button which opens the drawer.
 */
export const bottomNavPrimary: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "courses", icon: Icons.exam, labelKey: "nav.courses", to: "/academic/courses", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "sessions", icon: Icons.camera, labelKey: "nav.sessions", to: "/academic/sessions", permissions: ["can_view_sessions"] },
  { id: "recordings", icon: Icons.film, labelKey: "nav.recordings", to: "/recordings", permissions: ["can_view_dashboard"] },
];

/**
 * Items shown inside the drawer.
 */
export const drawerNavItems: NavItem[] = [
  { id: "classes", icon: Icons.people, labelKey: "nav.classes", to: "/academic/classes", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "assessments", icon: Icons.tools, labelKey: "nav.assessments", to: "/academic/assessments", permissions: ["can_view_dashboard"] },
  { id: "members", icon: Icons.people, labelKey: "nav.members", to: "/crm/members", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "ledger", icon: Icons.barChart, labelKey: "nav.ledger", to: "/finance/ledger", permissions: ["can_view_financials"] },
  { id: "organization", icon: Icons.settings, labelKey: "nav.orgSettings", to: "/settings/organization", permissions: ["can_manage_members"] },
];

