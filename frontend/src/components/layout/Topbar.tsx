import { useNavigate } from "react-router-dom";
import { Tooltip } from "../ui/Tooltip";
import { useAuthStore } from "../../features/auth/store/authStore";
import { Icons } from "../../lib/constants/icons";

interface TopbarProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function Topbar({
  title,
  subtitle,
  isDark,
  onToggleTheme,
}: TopbarProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-5 bg-[var(--s1)] border-b border-[var(--b)] transition-colors duration-300">
      <div className="flex flex-col">
        <span className="text-[14px] font-semibold text-[var(--t1)]">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] text-[var(--t3)]">{subtitle}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip
          content={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150"
          >
            {isDark ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        <Tooltip content="Search">
          <button className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            🔍
          </button>
        </Tooltip>

        <Tooltip content="Notifications · 3 new">
          <button className="relative w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            🔔
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--red)] rounded-full border-2 border-[var(--s1)]" />
          </button>
        </Tooltip>

        <Tooltip content="Settings">
          <button className="w-8 h-8 rounded-lg bg-transparent border-none text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center text-base transition-all duration-150">
            ⚙️
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-[var(--b)] mx-1" />

        <Tooltip content="Sign out">
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
