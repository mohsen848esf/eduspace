import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";
import {
  useThemeStore,
  applyPlatformThemeToDOM,
  applyOrgThemeToDOM,
  type ThemeMode,
} from "../store/themeStore";

export default function ThemeScopeController() {
  const location = useLocation();
  const { user } = useAuthStore();
  const { activeSlug, orgContext } = useOrgContextStore();
  const theme = useThemeStore((s) => s.theme);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    const path = location.pathname;

    // 1. Core Call & Video Services
    const isCallRoute = path.startsWith("/room");

    // 2. Auth & Public Entry Routes
    const isAuthRoute =
      path === "/login" ||
      path === "/register" ||
      path.startsWith("/join") ||
      path === "/unauthorized";

    // 3. User with No Organizations (Standalone Platform Personal Mode)
    const hasOrg = Boolean(
      (user?.organizations && user.organizations.length > 0) ||
        (activeSlug && activeSlug !== "no organization") ||
        orgContext,
    );
    const isPersonalHome = path === "/dashboard" && !hasOrg;

    const isPlatformScoped = isCallRoute || isAuthRoute || isPersonalHome;

    if (isPlatformScoped) {
      // Force direct Platform Theme (Dark Navy/Slate #08131F)
      applyPlatformThemeToDOM();
    } else {
      // Organization Workspace: Apply organization white-label theme
      const branding = orgContext?.organization?.branding;

      // Determine active mode from user preference & org branding
      let activeMode: ThemeMode = theme;
      if (branding?.default_theme) {
        if (isDark) {
          activeMode = branding.default_theme.startsWith("dark")
            ? branding.default_theme
            : branding.is_tinted !== false
            ? "dark-tinted"
            : "dark";
        } else {
          activeMode = branding.default_theme.startsWith("light")
            ? branding.default_theme
            : branding.is_tinted !== false
            ? "light-tinted"
            : "light";
        }
      }

      applyOrgThemeToDOM(branding, activeMode);
    }
  }, [location.pathname, theme, isDark, user, activeSlug, orgContext]);

  return null;
}
