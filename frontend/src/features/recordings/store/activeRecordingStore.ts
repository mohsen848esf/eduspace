import { create } from "zustand";

interface ActiveRecordingState {
  /** Token of an in-progress recording in the current room (if any). */
  inFlightToken: string | null;
  /**
   * Token of the most recently finished recording the host should land
   * on once the call ends. Cleared after navigation.
   */
  pendingEditToken: string | null;
  setInFlight: (token: string | null) => void;
  setPendingEdit: (token: string | null) => void;
  reset: () => void;
}

/**
 * Bridges the recording status (which lives inside RoomTopbar) and the
 * leave/disconnect flow (which lives in useRoomDisconnect). When the
 * host stops a recording while still in the call, we stash its token
 * here so the disconnect flow can navigate to /edit afterwards.
 */
export const useActiveRecordingStore = create<ActiveRecordingState>((set) => ({
  inFlightToken: null,
  pendingEditToken: null,
  setInFlight: (token) => set({ inFlightToken: token }),
  setPendingEdit: (token) => set({ pendingEditToken: token }),
  reset: () => set({ inFlightToken: null, pendingEditToken: null }),
}));
