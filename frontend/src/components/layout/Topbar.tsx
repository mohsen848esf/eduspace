import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { Icons } from "../../lib/constants/icons";
import { useLocale } from "../../i18n/useLocale";

interface TopbarProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  /** When true, render a leading hamburger button on the start side. */
  showHamburger?: boolean;
  /** Click handler for the hamburger; AppShell wires this to open the drawer. */
  onHamburgerClick?: () => void;
}

export default function Topbar({
  title,
  subtitle,
  isDark,
  onToggleTheme,
  showHamburger = false,
  onHamburgerClick,
}: TopbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["dashboard", "common", "auth"]);
  const { language, toggleLanguage } = useLocale();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const nextLanguageLabel =
    language === "en" ? t("common:language.persian") : t("common:language.english");

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between gap-2 px-4 md:px-5 bg-[var(--s1)] border-b border-[var(--b)] transition-colors duration-300">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showHamburger && (
          <Tooltip content={t("dashboard:nav.openMenu")}>
            <button
              onClick={onHamburgerClick}
              aria-label={t("dashboard:nav.openMenu")}
              className="w-10 h-10 -ms-1 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center transition-colors duration-150 flex-shrink-0"
            >
              {Icons.menu}
            </button>
          </Tooltip>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-semibold text-[var(--t1)] truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-[var(--t3)] truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Tooltip
          content={t("common:language.switchTo", {
            language: nextLanguageLabel,
          })}
        >
          <button
            onClick={toggleLanguage}
            className="px-2 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-xs font-semibold uppercase tracking-wider transition-all duration-150"
          >
            {language === "en" ? "EN" : "FA"}
          </button>
        </Tooltip>

        <Tooltip
          content={
            isDark
              ? t("topbar.switchToLight")
              : t("topbar.switchToDark")
          }
        >
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        <Tooltip content={t("topbar.search")}>
          <button className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            🔍
          </button>
        </Tooltip>

        <Tooltip content={t("topbar.notifications", { count: 3 })}>
          <button className="relative w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            🔔
            <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-[var(--red)] rounded-full border-2 border-[var(--s1)]" />
          </button>
        </Tooltip>

        <Tooltip content={t("topbar.settings")}>
          <button className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            ⚙️
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-[var(--b)] mx-1" />

        <Tooltip content={t("auth:signOutTooltip")}>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] flex items-center justify-center transition-all"
          >
            {Icons.leave}
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
