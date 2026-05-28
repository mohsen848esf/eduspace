import { useState } from "react";
import { cn } from "../../lib/utils";
import { Tooltip } from "../ui/Tooltip";

interface NavItem {
  icon: string;
  label: string;
  badge?: number;
  id: string;
}

const mainNav: NavItem[] = [
  { icon: "⊞", label: "Dashboard", id: "dashboard" },
  { icon: "📹", label: "Video Calls", id: "calls" },
  { icon: "🎮", label: "Games", id: "games" },
  { icon: "📝", label: "Exams", id: "exams" },
];

const manageNav: NavItem[] = [
  { icon: "👥", label: "Students", id: "students", badge: 3 },
  { icon: "📊", label: "Reports", id: "reports" },
  { icon: "🎬", label: "Recordings", id: "recordings" },
];

interface SidebarProps {
  activeId?: string;
  onNavigate?: (id: string) => void;
}

export default function Sidebar({
  activeId = "dashboard",
  onNavigate,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = activeId === item.id;
    const btn = (
      <button
        onClick={() => onNavigate?.(item.id)}
        className={cn(
          "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all duration-150",
          "text-left border-none cursor-pointer",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
            : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
        )}
      >
        <span className="text-base w-5 h-5 flex items-center justify-center flex-shrink-0">
          {item.icon}
        </span>
        {!collapsed && (
          <span
            className={cn(
              "text-[13px] font-medium flex-1 whitespace-nowrap",
              isActive && "font-semibold",
            )}
          >
            {item.label}
          </span>
        )}
        {!collapsed && item.badge && (
          <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </button>
    );

    return collapsed ? (
      <Tooltip
        content={item.badge ? `${item.label} · ${item.badge} new` : item.label}
        side="right"
      >
        {btn}
      </Tooltip>
    ) : (
      btn
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full",
        "bg-[var(--s1)] border-r border-[var(--b)]",
        "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 px-3 border-b border-[var(--b)] flex-shrink-0",
          collapsed && "justify-center",
        )}
      >
        <Tooltip
          content={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          side="right"
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0",
              collapsed && "justify-center",
            )}
          >
            <div className="w-8 h-8 bg-[var(--brand)] rounded-[9px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              E
            </div>
            {!collapsed && (
              <span className="text-[15px] font-bold text-[var(--t1)] whitespace-nowrap">
                EduSpace
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-hidden">
        {!collapsed && (
          <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-[0.8px] px-2.5 py-2">
            Main
          </span>
        )}
        {mainNav.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}

        {!collapsed && (
          <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-[0.8px] px-2.5 py-2 mt-2">
            Manage
          </span>
        )}
        {manageNav.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      {/* User */}
      <div className="p-2 border-t border-[var(--b)]">
        <Tooltip content="Your profile" side="right">
          <button
            className={cn(
              "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg",
              "bg-transparent border-none cursor-pointer",
              "hover:bg-[var(--s3)] transition-all duration-150",
              collapsed && "justify-center px-2",
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--cyan)] flex items-center justify-center text-white text-xs font-bold">
                A
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-[var(--green)] rounded-full border-2 border-[var(--s1)]" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden text-left">
                <div className="text-xs font-semibold text-[var(--t1)] whitespace-nowrap">
                  Ali Rezaei
                </div>
                <div className="text-[10px] text-[var(--t3)] whitespace-nowrap">
                  Teacher
                </div>
              </div>
            )}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
