import { create } from "zustand";

interface RoomState {
  token: string | null;
  livekitUrl: string | null;
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;
  isGuest: boolean;
  guestIdentity: string | null;
  requireApproval: boolean;
  isLocked: boolean;
  mutedByHost: Set<string>;
  setMutedByHost: (identity: string, muted: boolean) => void;
  setRoomSettings: (settings: {
    requireApproval?: boolean;
    isLocked?: boolean;
  }) => void;

  setRoom: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
    isGuest?: boolean;
    guestIdentity?: string | null;
    requireApproval?: boolean;
    isLocked?: boolean;
  }) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  token: null,
  livekitUrl: null,
  roomCode: null,
  roomName: null,
  isHost: false,
  isGuest: false,
  guestIdentity: null,
  requireApproval: false,
  isLocked: false,
  mutedByHost: new Set<string>(),
  setMutedByHost: (identity, muted) =>
    set((state) => {
      const updated = new Set(state.mutedByHost);
      if (muted) updated.add(identity);
      else updated.delete(identity);
      return { mutedByHost: updated };
    }),
  setRoomSettings: (settings) =>
    set((state) => ({
      requireApproval:
        settings.requireApproval !== undefined
          ? settings.requireApproval
          : state.requireApproval,
      isLocked:
        settings.isLocked !== undefined ? settings.isLocked : state.isLocked,
    })),
  setRoom: (data) =>
    set({
      token: data.token,
      livekitUrl: data.livekitUrl,
      roomCode: data.roomCode,
      roomName: data.roomName,
      isHost: data.isHost,
      isGuest: data.isGuest || false,
      guestIdentity: data.guestIdentity || null,
      requireApproval: data.requireApproval || false,
      isLocked: data.isLocked || false,
    }),
  clearRoom: () =>
    set({
      token: null,
      livekitUrl: null,
      roomCode: null,
      roomName: null,
      isHost: false,
      isGuest: false,
      guestIdentity: null,
      requireApproval: false,
      isLocked: false,
    }),
}));

