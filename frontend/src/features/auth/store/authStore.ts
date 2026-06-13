import { create } from "zustand";
import i18n from "../../../i18n/config";
import { authApi, type User } from "../api/auth.api";
import type { LoginInput, RegisterPayload } from "../schemas/auth.schema";

import { useOrgContextStore } from "./orgContextStore";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isAuthenticated: boolean;

  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
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
      const res = await authApi.login(data);
      localStorage.setItem("access_token", res.access);
      localStorage.setItem("refresh_token", res.refresh);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || i18n.t("auth:errors.loginFailed"),
        isLoading: false,
      });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      localStorage.setItem("access_token", res.access);
      localStorage.setItem("refresh_token", res.refresh);
      set({ user: res.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const errors = err.response?.data;
      const message = errors
        ? Object.values(errors).flat().join(" ")
        : i18n.t("auth:errors.registerFailed");
      set({ error: message, isLoading: false });
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
      set({ isInitialized: true, isAuthenticated: false });
      return;
    }
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
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
