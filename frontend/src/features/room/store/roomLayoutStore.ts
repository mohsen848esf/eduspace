import { create } from "zustand";

export type ActivePanel = "video" | "people" | "chat" | "tools";
export type LayoutMode = "auto" | "tiled" | "spotlight" | "sidebar";

export const MAX_TILES_OPTIONS = [6, 9, 16, 30, 49] as const;
export type MaxTilesOption = (typeof MAX_TILES_OPTIONS)[number];

interface LayoutPreferences {
  layoutMode: LayoutMode;
  maxTiles: number;
  hideNoVideo: boolean;
}

const STORAGE_KEY = "eduspace_layout_preferences";

function loadStoredPreferences(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        layoutMode: ["auto", "tiled", "spotlight", "sidebar"].includes(parsed.layoutMode)
          ? parsed.layoutMode
          : "auto",
        maxTiles: typeof parsed.maxTiles === "number" ? parsed.maxTiles : 6,
        hideNoVideo: Boolean(parsed.hideNoVideo),
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    layoutMode: "auto",
    maxTiles: 6,
    hideNoVideo: false,
  };
}

function savePreferences(prefs: Partial<LayoutPreferences>) {
  try {
    const current = loadStoredPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

interface RoomLayoutState {
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;

  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;

  maxTiles: number;
  setMaxTiles: (count: number) => void;

  hideNoVideo: boolean;
  setHideNoVideo: (hide: boolean) => void;

  isAdjustViewOpen: boolean;
  setAdjustViewOpen: (open: boolean) => void;
}

const initialPrefs = loadStoredPreferences();

export const useRoomLayoutStore = create<RoomLayoutState>()((set) => ({
  activePanel: "video",
  setActivePanel: (p) => set({ activePanel: p }),

  layoutMode: initialPrefs.layoutMode,
  setLayoutMode: (mode) => {
    savePreferences({ layoutMode: mode });
    set({ layoutMode: mode });
  },

  maxTiles: initialPrefs.maxTiles,
  setMaxTiles: (count) => {
    savePreferences({ maxTiles: count });
    set({ maxTiles: count });
  },

  hideNoVideo: initialPrefs.hideNoVideo,
  setHideNoVideo: (hide) => {
    savePreferences({ hideNoVideo: hide });
    set({ hideNoVideo: hide });
  },

  isAdjustViewOpen: false,
  setAdjustViewOpen: (open) => set({ isAdjustViewOpen: open }),
}));
