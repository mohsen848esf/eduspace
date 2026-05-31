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
 * layouts. Hosts the Participants / Chat / Tools tab content.
 *
 * Collapse behaviour
 * ------------------
 * When `activeTab` is null (the user clicked an active tab to dismiss
 * it, or hit the close button), we don't unmount the sidebar — we
 * collapse its width to zero with a smooth transition so the video
 * grid grows into the freed space gracefully. Bringing the sidebar
 * back from the bottom-bar buttons reverses the same animation.
 *
 * Why not unmount? Two reasons:
 *   1. WebSocket subscriptions in ChatPanel would re-establish on every
 *      open, dropping recent messages while the socket reconnects.
 *   2. The animation would be janky: a width transition can't run on
 *      an element that's just been added to the DOM the same frame.
 */
export default function RoomSidebar({
  activeTab,
  onTabChange,
  roomCode,
  width = "desktop",
}: RoomSidebarProps) {
  const { t } = useTranslation("room");

  const tabs: { id: NonNullable<SidebarTab>; icon: React.ReactNode; tooltip: string }[] = [
    {
      id: "participants",
      icon: Icons.people,
      tooltip: t("tooltips.participants"),
    },
    { id: "chat", icon: Icons.chat, tooltip: t("tooltips.chat") },
    { id: "tools", icon: Icons.tools, tooltip: t("tooltips.tools") },
  ];

  const isOpen = activeTab !== null;
  const openWidthClass = width === "tablet" ? "w-60" : "w-[272px]";

  return (
    <div
      // The width animates between full-open and zero. `overflow-hidden`
      // hides the panel content during the transition so it doesn't
      // bleed into the video grid as it shrinks.
      className={cn(
        "bg-[var(--s1)] border-s border-[var(--b)] flex flex-col flex-shrink-0",
        "transition-[width] duration-300 ease-out overflow-hidden",
        isOpen ? openWidthClass : "w-0",
      )}
      aria-hidden={!isOpen}
    >
      {/* Inner wrapper at the open width so the children don't reflow
          while the outer width animates. Once collapsed, overflow-hidden
          on the parent clips this neatly. */}
      <div className={cn("flex flex-col h-full", openWidthClass)}>
        <div className="flex items-center justify-between gap-1.5 p-2 border-b border-[var(--b)] flex-shrink-0">
          <div className="flex items-center gap-1.5">
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
          <Tooltip content={t("sidebar.collapse")}>
            <button
              onClick={() => onTabChange(activeTab)}
              aria-label={t("sidebar.collapse")}
              className={cn(
                "w-7 h-7 rounded-md border-none cursor-pointer",
                "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
                "flex items-center justify-center transition-colors text-base",
              )}
            >
              ›
            </button>
          </Tooltip>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-3">
          {activeTab === "participants" && <ParticipantsPanel />}
          {activeTab === "chat" && <ChatPanel roomCode={roomCode} />}
          {activeTab === "tools" && <ToolsPanel />}
        </div>
      </div>
    </div>
  );
}
