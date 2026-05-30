import { useTranslation } from "react-i18next";
import { type SidebarTab } from "../hooks/useRoomControls";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import { Tooltip } from "../../../components/ui/Tooltip";
import ParticipantsPanel from "./panels/ParticipantsPanel";
import ChatPanel from "./panels/ChatPanel";
import ToolsPanel from "./panels/ToolsPanel";

interface RoomSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  roomCode: string;
  /** Render width — narrower on tablet (240px), wider on desktop (272px). */
  width?: "tablet" | "desktop";
}

/**
 * Docked side panel used on tablet (240px) and desktop (272px) in-call
 * layouts. Hosts the Participants / Chat / Tools tab content extracted
 * into reusable Panel components so the mobile shells (swipe stage,
 * bottom sheets) can render the same UI without duplication.
 */
export default function RoomSidebar({
  activeTab,
  onTabChange,
  roomCode,
  width = "desktop",
}: RoomSidebarProps) {
  const { t } = useTranslation("room");
  if (!activeTab) return null;

  const tabs: { id: SidebarTab; icon: React.ReactNode; tooltip: string }[] = [
    {
      id: "participants",
      icon: Icons.people,
      tooltip: t("tooltips.participants"),
    },
    { id: "chat", icon: Icons.chat, tooltip: t("tooltips.chat") },
    { id: "tools", icon: Icons.tools, tooltip: t("tooltips.tools") },
  ];

  const widthClass = width === "tablet" ? "w-60" : "w-[272px]";

  return (
    <div
      className={cn(
        widthClass,
        "bg-[var(--s1)] border-s border-[var(--b)] flex flex-col flex-shrink-0 fade-in",
      )}
    >
      <div className="flex items-center justify-center gap-1.5 p-2 border-b border-[var(--b)] flex-shrink-0">
        {tabs.map((tab) => (
          <Tooltip key={tab.id} content={tab.tooltip}>
            <button
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-9 h-9 rounded-lg border-none cursor-pointer",
                "flex items-center justify-center transition-all duration-150",
                activeTab === tab.id
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
              )}
            >
              {tab.icon}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-3">
        {activeTab === "participants" && <ParticipantsPanel />}
        {activeTab === "chat" && <ChatPanel roomCode={roomCode} />}
        {activeTab === "tools" && <ToolsPanel />}
      </div>
    </div>
  );
}
