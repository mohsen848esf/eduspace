import { create } from "zustand";

/**
 * Logical "active" panel inside the call. On mobile this drives which
 * BottomSheet (if any) is open above the always-visible video grid.
 * On tablet/desktop the value is informational; the docked sidebar's
 * own SidebarTab still drives the side panel.
 *
 * "video" means no panel sheet is open (the user is looking at the call
 * surface).
 */
export type ActivePanel = "video" | "people" | "chat" | "tools";

interface RoomLayoutState {
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;
}

/**
 * Session-only store. Nothing here is persisted because the only field
 * (activePanel) should always reset to "video" on a fresh page load.
 *
 * The previous version of this store also held a "mobileMode" toggle
 * (swipe vs. sheet). The swipe shell was removed because a transformed
 * track captured `position: fixed` modals and `Element.scrollIntoView`
 * calls inside its descendants (chat auto-scroll, search input focus)
 * — leading to the visible content desyncing from the active tab. The
 * single-mode sheet shell is simpler, more robust, and matches the
 * design language users already know from native mobile apps.
 */
export const useRoomLayoutStore = create<RoomLayoutState>()((set) => ({
  activePanel: "video",
  setActivePanel: (p) => set({ activePanel: p }),
}));
