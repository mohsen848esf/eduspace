import { create } from "zustand";
import { authApi, type OrgContext } from "../api/auth.api";

interface OrgContextState {
  orgContext: OrgContext | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  activeSlug: string;

  fetchOrgContext: (slug?: string) => Promise<void>;
  setActiveSlug: (slug: string) => void;
  clearOrgContext: () => void;
}

export const useOrgContextStore = create<OrgContextState>((set, get) => ({
  orgContext: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  activeSlug: localStorage.getItem("active_org_slug") || "default-academy",

  fetchOrgContext: async (slug) => {
    const targetSlug = slug || get().activeSlug;
    set({ isLoading: true, error: null, activeSlug: targetSlug });
    localStorage.setItem("active_org_slug", targetSlug);
    try {
      const context = await authApi.getOrgContext();
      set({ orgContext: context, isInitialized: true, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || err.response?.data?.detail || "Failed to fetch organization context",
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  setActiveSlug: (slug) => {
    set({ activeSlug: slug });
    localStorage.setItem("active_org_slug", slug);
  },

  clearOrgContext: () => {
    set({ orgContext: null, isInitialized: false, error: null });
  },
}));
