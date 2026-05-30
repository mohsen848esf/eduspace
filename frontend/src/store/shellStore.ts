import { create } from "zustand";

/**
 * Shared UI state for the authenticated AppShell.
 *
 * Currently scoped to the mobile drawer (opened via the topbar hamburger
 * or the bottom-nav "More" item). Lives outside the components so any
 * page or layout primitive can pop it open without prop-drilling.
 *
 * Intentionally not persisted — the drawer should always start closed
 * on a fresh page load.
 */
interface ShellState {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
}));
