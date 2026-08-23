import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrganizationBranding } from "../features/auth/api/auth.api";
import { generateThemeTokens } from "../lib/themeGenerator";

export type ThemeMode = "dark" | "light" | "dark-tinted" | "light-tinted";

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  setDark: (isDark: boolean) => void;
  toggleTheme: () => void;
}

const INJECTED_CSS_VARS = [
  "--brand",
  "--brand-h",
  "--brand-soft",
  "--brand-text",
  "--brand-dark",
  "--s0",
  "--s1",
  "--s2",
  "--s3",
  "--s4",
  "--b",
  "--b-soft",
  "--bh",
  "--t1",
  "--t2",
  "--t3",
  "--green",
  "--amber",
  "--cyan",
  "--red",
  "--purple",
  "--chart-primary",
  "--chart-secondary",
  "--chart-grid",
  "--chart-label",
  "--header-bg",
  "--header-border",
];

export const applyPlatformThemeToDOM = (mode: "dark" | "light" = "dark") => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Clear any existing custom org variables
  INJECTED_CSS_VARS.forEach((varName) => {
    root.style.removeProperty(varName);
  });

  const platformTokens =
    mode === "light"
      ? {
          "--brand": "#2563EB",
          "--brand-h": "#1D4ED8",
          "--brand-soft": "rgba(37, 99, 235, 0.10)",
          "--brand-text": "#FFFFFF",
          "--brand-dark": "#0F172A",
          "--s0": "#F8FAFC",
          "--s1": "#FFFFFF",
          "--s2": "#FFFFFF",
          "--s3": "#F1F5F9",
          "--s4": "#E2E8F0",
          "--b": "#E2E8F0",
          "--b-soft": "#EEF2F6",
          "--bh": "#2563EB",
          "--t1": "#0F172A",
          "--t2": "#475569",
          "--t3": "#64748B",
          "--header-bg": "#08131F",
          "--header-border": "#14283D",
        }
      : {
          "--brand": "#38BDF8",
          "--brand-h": "#0EA5E9",
          "--brand-soft": "rgba(56, 189, 248, 0.14)",
          "--brand-text": "#04140F",
          "--brand-dark": "#060A12",
          "--s0": "#0B111E",
          "--s1": "#0E1626",
          "--s2": "#141F36",
          "--s3": "#1A2744",
          "--s4": "#223254",
          "--b": "#1E2D4A",
          "--b-soft": "#18243C",
          "--bh": "#38BDF8",
          "--t1": "#F8FAFC",
          "--t2": "#94A3B8",
          "--t3": "#64748B",
          "--header-bg": "#08131F",
          "--header-border": "#14283D",
        };

  Object.entries(platformTokens).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  root.classList.remove("light", "dark-tinted", "light-tinted");
  if (mode === "light") {
    root.classList.add("light");
    root.setAttribute("data-theme", "platform-light");
  } else {
    root.setAttribute("data-theme", "platform-dark");
  }
};

export const applyThemeToDOM = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark-tinted", "light-tinted");
  root.removeAttribute("data-theme");

  if (theme === "light") {
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
  } else if (theme === "dark-tinted") {
    root.classList.add("dark-tinted");
    root.setAttribute("data-theme", "dark-tinted");
  } else if (theme === "light-tinted") {
    root.classList.add("light-tinted");
    root.setAttribute("data-theme", "light-tinted");
  } else {
    root.setAttribute("data-theme", "dark");
  }
};

export const applyOrgThemeToDOM = (
  branding?: OrganizationBranding,
  modeOverride?: ThemeMode
) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const mode = modeOverride || branding?.default_theme || "dark-tinted";
  const tokens = generateThemeTokens({
    primary: branding?.primary_color || "#00D084",
    secondary: branding?.secondary_color || "#FFB000",
    mode,
    customTokens: branding?.custom_tokens,
  });

  // Inject computed 3-tier CSS variables directly on root
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.classList.remove("light", "dark-tinted", "light-tinted");
  root.removeAttribute("data-theme");

  if (mode === "light") {
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
  } else if (mode === "light-tinted") {
    root.classList.add("light-tinted");
    root.setAttribute("data-theme", "light-tinted");
  } else if (mode === "dark-tinted") {
    root.classList.add("dark-tinted");
    root.setAttribute("data-theme", "dark-tinted");
  } else {
    root.setAttribute("data-theme", "dark");
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark-tinted",
      isDark: true,
      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme, isDark: theme === "dark" || theme === "dark-tinted" });
      },
      setDark: (isDark) => {
        const nextTheme: ThemeMode = isDark ? "dark-tinted" : "light";
        applyThemeToDOM(nextTheme);
        set({ theme: nextTheme, isDark });
      },
      toggleTheme: () => {
        set((state) => {
          const next: ThemeMode =
            state.theme === "light" || state.theme === "light-tinted"
              ? "dark-tinted"
              : "light";
          applyThemeToDOM(next);
          return { theme: next, isDark: next === "dark-tinted" };
        });
      },
    }),
    {
      name: "eduspace_theme",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          applyThemeToDOM(state.theme || "dark-tinted");
        }
      },
    },
  ),
);

