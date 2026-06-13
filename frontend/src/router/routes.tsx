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

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<any>;
  isPrivate: boolean;
  requiredPermissions?: string[];
}

export const routes: RouteConfig[] = [
  {
    path: "/login",
    component: LoginPage,
    isPrivate: false,
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
