import { lazy } from "react";

const LoginPage = lazy(() => import("../features/auth/components/LoginPage"));
const RegisterPage = lazy(
  () => import("../features/auth/components/RegisterPage"),
);
const DashboardPage = lazy(
  () => import("../features/dashboard/components/DashboardPage"),
);
const RoomPage = lazy(() => import("../features/room/components/RoomPage"));
const MiniAppsPage = lazy(
  () => import("../features/miniapps/components/MiniAppsPage"),
);
const RecordingsPage = lazy(
  () => import("../features/recordings/components/RecordingsPage"),
);
const RecordingEditPage = lazy(
  () => import("../features/recordings/components/RecordingEditPage"),
);
const RecordingViewPage = lazy(
  () => import("../features/recordings/components/RecordingViewPage"),
);
const TakeAssessmentPage = lazy(
  () => import("../features/assessments/pages/TakeAssessmentPage"),
);
const AssessmentResultsPage = lazy(
  () => import("../features/assessments/pages/AssessmentResultsPage"),
);
const ReviewSubmissionPage = lazy(
  () => import("../features/assessments/pages/ReviewSubmissionPage"),
);

// Newly disaggregated pages
const CoursesPage = lazy(
  () => import("../features/dashboard/components/CoursesPage"),
);
const CourseDetailPage = lazy(
  () => import("../features/dashboard/components/CourseDetailPage"),
);
const ClassesPage = lazy(
  () => import("../features/dashboard/components/ClassesPage"),
);
const ClassDetailPage = lazy(
  () => import("../features/dashboard/components/ClassDetailPage"),
);
const SessionsPage = lazy(
  () => import("../features/dashboard/components/SessionsPage"),
);
const AssessmentsPage = lazy(
  () => import("../features/dashboard/components/AssessmentsPage"),
);
const MembersPage = lazy(
  () => import("../features/dashboard/components/MembersPage"),
);
const LedgerPage = lazy(
  () => import("../features/dashboard/components/LedgerPage"),
);
const InvoiceDetailPage = lazy(
  () => import("../features/dashboard/components/InvoiceDetailPage"),
);
const OrgSettingsPage = lazy(
  () => import("../features/dashboard/components/OrgSettingsPage"),
);
const ProfileCompletionPage = lazy(
  () => import("../features/dashboard/components/ProfileCompletionPage"),
);
const LeaderboardPage = lazy(
  () => import("../features/dashboard/components/LeaderboardPage"),
);
const NotificationSettingsPage = lazy(
  () => import("../features/auth/components/NotificationSettings"),
);
const TemplateManagerPage = lazy(
  () => import("../features/dashboard/components/TemplateManager"),
);
const SysAdminPage = lazy(
  () => import("../features/sysadmin/components/SysAdminPage"),
);
const SubscriptionPage = lazy(
  () => import("../features/billing/components/SubscriptionPage"),
);
const AssignmentDetailPage = lazy(
  () => import("../features/assessments/pages/AssignmentDetailPage"),
);

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<any>;
  isPrivate: boolean;
  requiredPermissions?: string[];
  isSuperUserOnly?: boolean;
}

export const routes: RouteConfig[] = [
  {
    path: "/login",
    component: LoginPage,
    isPrivate: false,
  },
  {
    path: "/sys-admin",
    component: SysAdminPage,
    isPrivate: true,
    isSuperUserOnly: true,
  },
  {
    path: "/register",
    component: RegisterPage,
    isPrivate: false,
  },
  {
    path: "/dashboard",
    component: DashboardPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/courses",
    component: CoursesPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/courses/:courseId",
    component: CourseDetailPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/classes",
    component: ClassesPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/classes/:classId",
    component: ClassDetailPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/assignments/:assignmentId",
    component: AssignmentDetailPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/academic/sessions",
    component: SessionsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_sessions"],
  },
  {
    path: "/academic/assessments",
    component: AssessmentsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/crm/members",
    component: MembersPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/finance/ledger",
    component: LedgerPage,
    isPrivate: true,
    requiredPermissions: ["can_view_financials"],
  },
  {
    path: "/finance/invoices/:invoiceId",
    component: InvoiceDetailPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/settings/organization",
    component: OrgSettingsPage,
    isPrivate: true,
    requiredPermissions: ["can_manage_members"],
  },
  {
    path: "/settings/billing",
    component: SubscriptionPage,
    isPrivate: true,
    requiredPermissions: ["can_manage_members"],
  },
  {
    path: "/settings/profile",
    component: ProfileCompletionPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/settings/notifications",
    component: NotificationSettingsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/settings/templates",
    component: TemplateManagerPage,
    isPrivate: true,
    requiredPermissions: ["can_manage_members"],
  },
  {
    path: "/leaderboard",
    component: LeaderboardPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/room/:roomCode",
    component: RoomPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/miniapps",
    component: MiniAppsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/recordings",
    component: RecordingsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/recordings/:token",
    component: RecordingViewPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/recordings/:token/edit",
    component: RecordingEditPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/assessments/take/:submissionId",
    component: TakeAssessmentPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/assessments/results/:submissionId",
    component: AssessmentResultsPage,
    isPrivate: true,
    requiredPermissions: ["can_view_dashboard"],
  },
  {
    path: "/assessments/review/:submissionId",
    component: ReviewSubmissionPage,
    isPrivate: true,
    requiredPermissions: ["can_teach_class", "can_manage_members"],
  },
];

