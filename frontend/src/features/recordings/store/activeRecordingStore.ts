import { create } from "zustand";
import type { RoomRecordingStatus, RoomRecordingPermission } from "../api/recordings.api";

interface ActiveRecordingState {
  status: RoomRecordingStatus;
  permission: RoomRecordingPermission;
  /** Token of an in-progress recording in the current room (if any). */
  inFlightToken: string | null;
  /**
   * Token of the most recently finished recording the host should land
   * on once the call ends. Cleared after navigation.
   */
  pendingEditToken: string | null;
  setStatus: (status: RoomRecordingStatus) => void;
  setPermission: (permission: RoomRecordingPermission) => void;
  setInFlight: (token: string | null) => void;
  setPendingEdit: (token: string | null) => void;
  reset: () => void;
}

/**
 * Bridges the recording status across in-call components (RoomTopbar,
 * RoomMobileTopbar, RoomRecordingBadge) and the leave/disconnect flow.
 */
export const useActiveRecordingStore = create<ActiveRecordingState>((set) => ({
  status: { status: "idle", recording: null },
  permission: { can_control: false, is_host: false, grants: null },
  inFlightToken: null,
  pendingEditToken: null,
  setStatus: (status) => set({ status }),
  setPermission: (permission) => set({ permission }),
  setInFlight: (token) => set({ inFlightToken: token }),
  setPendingEdit: (token) => set({ pendingEditToken: token }),
  reset: () =>
    set({
      status: { status: "idle", recording: null },
      permission: { can_control: false, is_host: false, grants: null },
      inFlightToken: null,
      pendingEditToken: null,
    }),
}));
