import { lazy } from "react";

const LoginPage = lazy(() => import("../features/auth/components/LoginPage"));
const RegisterPage = lazy(
  () => import("../features/auth/components/RegisterPage"),
);
const DashboardPage = lazy(
  () => import("../features/dashboard/components/DashboardPage"),
);
const RoomPage = lazy(() => import("../features/room/components/RoomPage"));

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
];
