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
const MiniAppPlayerPage = lazy(
  () => import("../features/miniapps/components/MiniAppPlayerPage"),
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

export type UserRole = "student" | "teacher" | "admin";

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<any>;
  isPrivate: boolean;
  roles?: UserRole[];
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
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/room/:roomCode",
    component: RoomPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/miniapps",
    component: MiniAppsPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/miniapps/play/:slug",
    component: MiniAppPlayerPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/recordings",
    component: RecordingsPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/recordings/:token",
    component: RecordingViewPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
  {
    path: "/recordings/:token/edit",
    component: RecordingEditPage,
    isPrivate: true,
    roles: ["student", "teacher", "admin"],
  },
];
