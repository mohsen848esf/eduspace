import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "dark-tinted" | "light-tinted";

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  setDark: (isDark: boolean) => void;
  toggleTheme: () => void;
}

export const applyPlatformThemeToDOM = () => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
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

