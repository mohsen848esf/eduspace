import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { cn } from "../../lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export default function AppShell({
  children,
  title,
  subtitle,
  activeNav,
  onNavigate,
}: AppShellProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  return (
    <div
      className={cn(
        "flex w-full h-full",
        "bg-[var(--s0)] text-[var(--t1)]",
        "transition-colors duration-300",
      )}
    >
      <Sidebar activeId={activeNav} onNavigate={onNavigate} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
