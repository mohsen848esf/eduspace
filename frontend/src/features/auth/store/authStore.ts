import { create } from "zustand";
import i18n from "../../../i18n/config";
import { authApi, type User } from "../api/auth.api";
import type { ChangePasswordInput, LoginInput, RegisterPayload } from "../schemas/auth.schema";
import { useOrgContextStore } from "./orgContextStore";
import { useNotificationsStore } from "@/features/notifications/store/notificationsStore";
import { getApiErrorData, getApiErrorMessage } from "@/lib/api/errors";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isAuthenticated: boolean;

  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  changePassword: (data: ChangePasswordInput) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  isAuthenticated: false,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      localStorage.removeItem("active_org_slug_validated");
      const res = await authApi.login(data);
      localStorage.setItem("access_token", res.access);
      localStorage.setItem("refresh_token", res.refresh);
      useNotificationsStore.getState().setUserId(res.user.id);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getApiErrorMessage(error, i18n.t("auth:errors.loginFailed")),
        isLoading: false,
      });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      localStorage.removeItem("active_org_slug_validated");
      const res = await authApi.register(data);
      localStorage.setItem("access_token", res.access);
      localStorage.setItem("refresh_token", res.refresh);
      useNotificationsStore.getState().setUserId(res.user.id);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getApiErrorMessage(error, i18n.t("auth:errors.registerFailed")),
        isLoading: false,
      });
    }
  },

  changePassword: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.changePassword(data);
      localStorage.setItem("access_token", res.access);
      localStorage.setItem("refresh_token", res.refresh);
      useNotificationsStore.getState().setUserId(res.user.id);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error: unknown) {
      const apiError = getApiErrorData(error);
      const fieldErrors = apiError?.errors;
      const hasFieldError = (field: string) =>
        Boolean(apiError?.[field] || (fieldErrors && typeof fieldErrors === "object" && field in fieldErrors));
      const fallback = hasFieldError("current_password")
        ? i18n.t("auth:errors.incorrectCurrentPassword")
        : hasFieldError("confirm_password")
          ? i18n.t("auth:validation.passwordsMismatch")
          : hasFieldError("new_password")
            ? i18n.t("auth:errors.weakPassword")
            : i18n.t("auth:errors.changePasswordFailed");
      set({ error: hasFieldError("current_password") || hasFieldError("confirm_password") || hasFieldError("new_password")
        ? fallback
        : getApiErrorMessage(error, fallback), isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } catch {
      /* swallow */
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    useOrgContextStore.getState().clearOrgContext();
    useNotificationsStore.getState().setUserId(null);
    useNotificationsStore.getState().clearAll();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
    });
  },

  fetchMe: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      useNotificationsStore.getState().setUserId(null);
      useNotificationsStore.getState().clearAll();
      set({ isInitialized: true, isAuthenticated: false });
      return;
    }
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      useNotificationsStore.getState().setUserId(user.id);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      useNotificationsStore.getState().setUserId(null);
      useNotificationsStore.getState().clearAll();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
