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
  /** Optional roles list to restrict visibility of this nav item. */
  roles?: string[];
}

/** Items rendered in the desktop sidebar's MAIN section + tablet rail. */
export const mainNavItems: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "courses", icon: Icons.exam, labelKey: "nav.courses", to: "/academic/courses", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "classes", icon: Icons.people, labelKey: "nav.classes", to: "/academic/classes", permissions: ["can_view_dashboard"] },
  { id: "sessions", icon: Icons.camera, labelKey: "nav.sessions", to: "/academic/sessions", permissions: ["can_view_sessions"] },
  { id: "attendance", icon: Icons.people, labelKey: "nav.attendance", to: "/academic/attendance", permissions: ["can_view_attendance"] },
  { id: "homework", icon: Icons.exam, labelKey: "nav.homework", to: "/academic/homework", permissions: ["can_view_dashboard"], roles: ["student"] },
  { id: "payments", icon: Icons.barChart, labelKey: "nav.payments", to: "/academic/payments", permissions: ["can_view_dashboard"], roles: ["student"] },
  { id: "assessments", icon: Icons.tools, labelKey: "nav.assessments", to: "/academic/assessments", permissions: ["can_view_dashboard"] },
  { id: "leaderboard", icon: Icons.barChart, labelKey: "nav.leaderboard", to: "/leaderboard", permissions: ["can_view_dashboard"] },
  { id: "reports", icon: Icons.barChart, labelKey: "nav.reports", to: "/academic/reports", permissions: ["can_manage_members"] },
];

/** Items rendered in the desktop sidebar's MANAGE section + drawer. */
export const manageNavItems: NavItem[] = [
  { id: "members", icon: Icons.people, labelKey: "nav.members", to: "/crm/members", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "ledger", icon: Icons.barChart, labelKey: "nav.ledger", to: "/finance/ledger", permissions: ["can_view_financials"] },
  { id: "recordings", icon: Icons.film, labelKey: "nav.recordings", to: "/recordings" },
  { id: "notificationsSettings", icon: Icons.settings, labelKey: "nav.notificationSettings", to: "/settings/notifications" },
  { id: "templates", icon: Icons.settings, labelKey: "nav.templates", to: "/settings/templates", permissions: ["can_manage_members"] },
  { id: "organization", icon: Icons.settings, labelKey: "nav.orgSettings", to: "/settings/organization", permissions: ["can_manage_members"] },
  { id: "billing", icon: Icons.settings, labelKey: "nav.billing", to: "/settings/billing", permissions: ["can_manage_members"] },
];

/**
 * The 4 primary items shown on mobile's bottom nav. The 5th slot is the
 * "More" button which opens the drawer.
 */
export const bottomNavPrimary: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "courses", icon: Icons.exam, labelKey: "nav.courses", to: "/academic/courses", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "sessions", icon: Icons.camera, labelKey: "nav.sessions", to: "/academic/sessions", permissions: ["can_view_sessions"] },
  { id: "recordings", icon: Icons.film, labelKey: "nav.recordings", to: "/recordings" },
];

/**
 * Items shown inside the drawer.
 */
export const drawerNavItems: NavItem[] = [
  { id: "classes", icon: Icons.people, labelKey: "nav.classes", to: "/academic/classes", permissions: ["can_view_dashboard"] },
  { id: "attendance", icon: Icons.people, labelKey: "nav.attendance", to: "/academic/attendance", permissions: ["can_view_attendance"] },
  { id: "homework", icon: Icons.exam, labelKey: "nav.homework", to: "/academic/homework", permissions: ["can_view_dashboard"], roles: ["student"] },
  { id: "payments", icon: Icons.barChart, labelKey: "nav.payments", to: "/academic/payments", permissions: ["can_view_dashboard"], roles: ["student"] },
  { id: "assessments", icon: Icons.tools, labelKey: "nav.assessments", to: "/academic/assessments", permissions: ["can_view_dashboard"] },
  { id: "leaderboard", icon: Icons.barChart, labelKey: "nav.leaderboard", to: "/leaderboard", permissions: ["can_view_dashboard"] },
  { id: "reports", icon: Icons.barChart, labelKey: "nav.reports", to: "/academic/reports", permissions: ["can_manage_members"] },
  { id: "members", icon: Icons.people, labelKey: "nav.members", to: "/crm/members", permissions: ["can_manage_members", "can_teach_class"] },
  { id: "ledger", icon: Icons.barChart, labelKey: "nav.ledger", to: "/finance/ledger", permissions: ["can_view_financials"] },
  { id: "notificationsSettings", icon: Icons.settings, labelKey: "nav.notificationSettings", to: "/settings/notifications" },
  { id: "templates", icon: Icons.settings, labelKey: "nav.templates", to: "/settings/templates", permissions: ["can_manage_members"] },
  { id: "organization", icon: Icons.settings, labelKey: "nav.orgSettings", to: "/settings/organization", permissions: ["can_manage_members"] },
  { id: "billing", icon: Icons.settings, labelKey: "nav.billing", to: "/settings/billing", permissions: ["can_manage_members"] },
];

