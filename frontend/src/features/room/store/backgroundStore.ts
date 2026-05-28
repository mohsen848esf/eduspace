import { create } from "zustand";

export type BackgroundType =
  | "none"
  | "blur"
  | "office"
  | "nature"
  | "studio"
  | "minimal";

interface BackgroundStore {
  background: BackgroundType;
  setBackground: (bg: BackgroundType) => void;
}

export const useBackgroundStore = create<BackgroundStore>((set) => ({
  background: "none",
  setBackground: (bg) => set({ background: bg }),
}));
