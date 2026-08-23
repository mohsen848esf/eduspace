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

export const applyPlatformThemeToDOM = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  
  // Clear any dynamically injected inline CSS variables so default stylesheet applies
  INJECTED_CSS_VARS.forEach((varName) => {
    root.style.removeProperty(varName);
  });

  root.classList.remove("light", "dark-tinted", "light-tinted");
  root.setAttribute("data-theme", "platform");
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

