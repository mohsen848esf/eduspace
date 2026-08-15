import { create } from "zustand";

interface RoomState {
  token: string | null;
  livekitUrl: string | null;
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;
  isGuest: boolean;
  guestIdentity: string | null;
  mutedByHost: Set<string>;
  setMutedByHost: (identity: string, muted: boolean) => void;

  setRoom: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
    isGuest?: boolean;
    guestIdentity?: string | null;
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
  mutedByHost: new Set<string>(),
  setMutedByHost: (identity, muted) =>
    set((state) => {
      const updated = new Set(state.mutedByHost);
      if (muted) updated.add(identity);
      else updated.delete(identity);
      return { mutedByHost: updated };
    }),
  setRoom: (data) =>
    set({
      token: data.token,
      livekitUrl: data.livekitUrl,
      roomCode: data.roomCode,
      roomName: data.roomName,
      isHost: data.isHost,
      isGuest: data.isGuest || false,
      guestIdentity: data.guestIdentity || null,
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
    }),
}));
