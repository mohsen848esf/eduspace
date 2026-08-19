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
  /** Optional route — when set, links navigate here on click. */
  to?: string;
  /** Optional unread / counter badge (small red pill). */
  badge?: number;
  /** Optional required permissions list to view this nav item (uses hasAnyPermission). */
  permissions?: string[];
  /** Optional roles list to restrict visibility of this nav item. */
  roles?: string[];
  /** Optional sub-navigation children (rendered as expandable accordion). */
  children?: NavItem[];
}

/**
 * Primary top-level direct navigation items (always shown at the top of sidebar).
 */
export const primaryNavItems: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "inbox", icon: Icons.bell, labelKey: "nav.inbox", to: "/inbox" },
];

/**
 * Categorized navigation groups with nested children.
 */
export const categoryNavItems: NavItem[] = [
  {
    id: "academic",
    icon: Icons.exam,
    labelKey: "nav.academic",
    children: [
      {
        id: "courses",
        icon: Icons.exam,
        labelKey: "nav.courses",
        to: "/academic/courses",
        permissions: ["can_manage_members", "can_teach_class"],
      },
      {
        id: "classes",
        icon: Icons.people,
        labelKey: "nav.classes",
        to: "/academic/classes",
        permissions: ["can_view_dashboard"],
      },
      {
        id: "sessions",
        icon: Icons.camera,
        labelKey: "nav.sessions",
        to: "/academic/sessions",
        permissions: ["can_view_sessions"],
      },
      {
        id: "attendance",
        icon: Icons.userCheck,
        labelKey: "nav.attendance",
        to: "/academic/attendance",
        permissions: ["can_view_attendance"],
      },
      {
        id: "homework",
        icon: Icons.exam,
        labelKey: "nav.homework",
        to: "/academic/homework",
        permissions: ["can_view_dashboard"],
      },
      {
        id: "payments",
        icon: Icons.barChart,
        labelKey: "nav.payments",
        to: "/academic/payments",
        permissions: ["can_view_dashboard"],
        roles: ["student"],
      },
      {
        id: "reports",
        icon: Icons.barChart,
        labelKey: "nav.reports",
        to: "/academic/reports",
        permissions: ["can_manage_members"],
      },
    ],
  },
  {
    id: "people",
    icon: Icons.users,
    labelKey: "nav.people",
    children: [
      {
        id: "members",
        icon: Icons.users,
        labelKey: "nav.members",
        to: "/crm/members",
        permissions: ["can_manage_members", "can_teach_class"],
      },
    ],
  },
  {
    id: "finance",
    icon: Icons.barChart,
    labelKey: "nav.finance",
    permissions: ["can_view_financials"],
    children: [
      {
        id: "ledger",
        icon: Icons.barChart,
        labelKey: "nav.ledger",
        to: "/finance/ledger",
        permissions: ["can_view_financials"],
      },
    ],
  },
  {
    id: "contentMedia",
    icon: Icons.game,
    labelKey: "nav.contentMedia",
    children: [
      {
        id: "miniapps",
        icon: Icons.game,
        labelKey: "nav.miniApps",
        to: "/miniapps",
        permissions: ["can_view_dashboard"],
      },
    ],
  },
  {
    id: "engagement",
    icon: Icons.barChart,
    labelKey: "nav.engagement",
    children: [
      {
        id: "leaderboard",
        icon: Icons.barChart,
        labelKey: "nav.leaderboard",
        to: "/leaderboard",
        permissions: ["can_view_dashboard"],
      },
    ],
  },
  {
    id: "settings",
    icon: Icons.settings,
    labelKey: "nav.settings",
    children: [
      {
        id: "organization",
        icon: Icons.settings,
        labelKey: "nav.orgSettings",
        to: "/settings/organization",
        permissions: ["can_manage_members"],
      },
      {
        id: "billing",
        icon: Icons.barChart,
        labelKey: "nav.billing",
        to: "/settings/billing",
        permissions: ["can_manage_members"],
      },
      {
        id: "templates",
        icon: Icons.settings,
        labelKey: "nav.templates",
        to: "/settings/templates",
        permissions: ["can_manage_members"],
      },
      {
        id: "profile",
        icon: Icons.people,
        labelKey: "nav.profile",
        to: "/settings/profile",
      },
      {
        id: "notificationsSettings",
        icon: Icons.bell,
        labelKey: "nav.notifications",
        to: "/settings/notifications",
      },
    ],
  },
];

/**
 * Backward compatibility exports for components expecting flat lists.
 */
export const mainNavItems: NavItem[] = [
  ...primaryNavItems,
  ...(categoryNavItems.find((g) => g.id === "academic")?.children || []),
  ...(categoryNavItems.find((g) => g.id === "contentMedia")?.children || []),
  ...(categoryNavItems.find((g) => g.id === "engagement")?.children || []),
];

export const manageNavItems: NavItem[] = [
  ...(categoryNavItems.find((g) => g.id === "people")?.children || []),
  ...(categoryNavItems.find((g) => g.id === "finance")?.children || []),
  ...(categoryNavItems.find((g) => g.id === "settings")?.children || []),
];

/**
 * Primary 4 quick-action items on mobile bottom navigation bar.
 */
export const bottomNavPrimary: NavItem[] = [
  { id: "dashboard", icon: Icons.home, labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "classes", icon: Icons.people, labelKey: "nav.classes", to: "/academic/classes", permissions: ["can_view_dashboard"] },
  { id: "sessions", icon: Icons.camera, labelKey: "nav.sessions", to: "/academic/sessions", permissions: ["can_view_sessions"] },
  { id: "inbox", icon: Icons.bell, labelKey: "nav.inbox", to: "/inbox" },
];

/**
 * Items shown in mobile drawer.
 */
export const drawerNavItems: NavItem[] = categoryNavItems;


