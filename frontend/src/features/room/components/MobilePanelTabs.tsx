import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import type { ActivePanel } from "../store/roomLayoutStore";

interface MobilePanelTabsProps {
  active: ActivePanel;
  onChange: (panel: ActivePanel) => void;
}

const TABS: {
  id: ActivePanel;
  icon: React.ReactNode;
  labelKey: string;
}[] = [
  { id: "video", icon: Icons.camera, labelKey: "controls.camera" },
  { id: "people", icon: Icons.people, labelKey: "controls.people" },
  { id: "chat", icon: Icons.chat, labelKey: "controls.chat" },
  { id: "tools", icon: Icons.tools, labelKey: "controls.tools" },
];

/**
 * Top tab strip rendered above each mobile in-call page.
 *
 * Replaces the swipe-dot indicator with explicit, tappable tabs so the
 * user can:
 *   - see which page they're on at a glance,
 *   - jump directly without swiping through neighbours,
 *   - always have an obvious way back to Video.
 *
 * The active tab is highlighted with a brand underline; the icon and
 * label use brand colours so it reads even with quick glances.
 */
export default function MobilePanelTabs({ active, onChange }: MobilePanelTabsProps) {
  const { t } = useTranslation("room");
  return (
    <div
      role="tablist"
      aria-label="Call panel"
      className="h-12 flex-shrink-0 grid grid-cols-4 bg-[var(--s1)] border-b border-[var(--b)]"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5",
              "border-none bg-transparent cursor-pointer relative",
              "transition-colors duration-150",
              isActive
                ? "text-[var(--brand-text)]"
                : "text-[var(--t3)] hover:text-[var(--t1)]",
            )}
          >
            <span className="leading-none [&>svg]:w-[18px] [&>svg]:h-[18px]">
              {tab.icon}
            </span>
            <span className="text-[10px] font-medium leading-none">
              {t(tab.labelKey)}
            </span>
            {isActive && (
              <span className="absolute bottom-0 start-1/2 -translate-x-1/2 w-8 h-0.5 rounded-t-full bg-[var(--brand)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
