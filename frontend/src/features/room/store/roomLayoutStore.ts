import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Mobile in-call layout style. The user toggles this from the in-call
 * Settings panel; tablet and desktop ignore the value because they use
 * the docked-panel layout regardless.
 *
 *   swipe — four full-screen pages (Video → People → Chat → Tools).
 *   sheet — full-screen video, panel buttons open a bottom sheet.
 */
export type MobileInCallMode = "swipe" | "sheet";

/**
 * Logical "active" panel inside the call. On mobile this drives both
 * the swipe stage's current page and the bottom-sheet's open state.
 * On tablet/desktop the value is informational; the docked sidebar's
 * own SidebarTab still drives the side panel.
 */
export type ActivePanel = "video" | "people" | "chat" | "tools";

interface RoomLayoutState {
  mobileMode: MobileInCallMode;
  setMobileMode: (m: MobileInCallMode) => void;

  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;
}

const VALID_MODES: MobileInCallMode[] = ["swipe", "sheet"];

export const useRoomLayoutStore = create<RoomLayoutState>()(
  persist(
    (set) => ({
      // Default: swipe pages. Matches the user-confirmed default from the spec.
      mobileMode: "swipe",
      setMobileMode: (m) => set({ mobileMode: m }),

      // Always start fresh on Video. Not persisted (see partialize below).
      activePanel: "video",
      setActivePanel: (p) => set({ activePanel: p }),
    }),
    {
      name: "eduspace.roomLayout",
      // Only persist mobileMode; activePanel resets per session.
      partialize: (state) => ({ mobileMode: state.mobileMode }),
      // Hydration guard: if the stored value isn't one of the known
      // options (different version, manual edit, etc.) fall back to swipe.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<RoomLayoutState>) };
        if (!VALID_MODES.includes(merged.mobileMode)) {
          merged.mobileMode = "swipe";
        }
        return merged;
      },
    },
  ),
);
