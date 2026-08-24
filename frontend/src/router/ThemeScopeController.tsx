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

    // 1. Auth & Public Entry Routes (Always platform scoped)
    const isAuthRoute =
      path === "/login" ||
      path === "/register" ||
      path.startsWith("/join") ||
      path === "/unauthorized";

    // 2. User Organization Context
    const hasOrg = Boolean(
      (user?.organizations && user.organizations.length > 0) ||
        (activeSlug && activeSlug !== "no organization" && activeSlug !== "null") ||
        orgContext?.organization,
    );

    const isPlatformScoped = isAuthRoute || !hasOrg;

    if (isPlatformScoped) {
      // Platform Personal / Non-Org Mode: Apply Platform Theme (Light or Dark)
      applyPlatformThemeToDOM(isDark ? "dark" : "light");
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
      } else {
        activeMode = isDark ? "dark" : "light";
      }

      applyOrgThemeToDOM(branding, activeMode);
    }
  }, [location.pathname, theme, isDark, user, activeSlug, orgContext]);

  return null;
}
