import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  isDark: boolean;
  setDark: (isDark: boolean) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true,
      setDark: (isDark) => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("light", !isDark);
        }
        set({ isDark });
      },
      toggleTheme: () => {
        set((state) => {
          const next = !state.isDark;
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("light", !next);
          }
          return { isDark: next };
        });
      },
    }),
    {
      name: "eduspace_theme",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.classList.toggle("light", !state.isDark);
        }
      },
    },
  ),
);
