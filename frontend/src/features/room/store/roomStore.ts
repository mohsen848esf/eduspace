import { create } from "zustand";

interface RoomState {
  token: string | null;
  livekitUrl: string | null;
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;
  // selectedBackground: BackgroundType;
  mutedByHost: Set<string>;
  setMutedByHost: (identity: string, muted: boolean) => void;

  setRoom: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
  }) => void;
  clearRoom: () => void;
  // setBackground: (bg: BackgroundType) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  token: null,
  livekitUrl: null,
  roomCode: null,
  roomName: null,
  isHost: false,
  mutedByHost: new Set<string>(),
  setMutedByHost: (identity, muted) =>
    set((state) => {
      const updated = new Set(state.mutedByHost);
      if (muted) updated.add(identity);
      else updated.delete(identity);
      return { mutedByHost: updated };
    }),
  setRoom: (data) => set(data),
  clearRoom: () =>
    set({
      token: null,
      livekitUrl: null,
      roomCode: null,
      roomName: null,
      isHost: false,
    }),
}));
