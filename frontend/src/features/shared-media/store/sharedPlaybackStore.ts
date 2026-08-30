import { create } from "zustand";
import type {
  SharedPlayback,
  SharedPlaybackSnapshot,
} from "../schemas/shared-media.schema";

interface SharedPlaybackState {
  roomCode: string | null;
  playback: SharedPlayback | null;
  lastServerNow: string | null;
  clockOffsetMs: number;
  applySnapshot: (roomCode: string, snapshot: SharedPlaybackSnapshot) => boolean;
  applyPlayback: (roomCode: string, playback: SharedPlayback) => boolean;
  setClockOffset: (roomCode: string, offsetMs: number) => void;
  reset: () => void;
}

const isOlder = (
  state: Pick<SharedPlaybackState, "roomCode" | "playback" | "lastServerNow">,
  roomCode: string,
  incoming: SharedPlayback | null,
  serverNow: string,
): boolean => {
  if (state.roomCode !== roomCode) return false;
  if (state.lastServerNow && Date.parse(serverNow) < Date.parse(state.lastServerNow)) return true;
  if (!state.playback || !incoming) return false;
  if (state.playback.id === incoming.id) return incoming.version < state.playback.version;
  return Date.parse(incoming.started_at) < Date.parse(state.playback.started_at);
};

export const useSharedPlaybackStore = create<SharedPlaybackState>((set, get) => ({
  roomCode: null,
  playback: null,
  lastServerNow: null,
  clockOffsetMs: 0,

  applySnapshot: (roomCode, snapshot) => {
    if (snapshot.playback && snapshot.playback.room_code !== roomCode) return false;
    if (isOlder(get(), roomCode, snapshot.playback, snapshot.server_now)) return false;
    set({ roomCode, playback: snapshot.playback, lastServerNow: snapshot.server_now });
    return true;
  },

  applyPlayback: (roomCode, playback) => {
    if (playback.room_code !== roomCode) return false;
    if (isOlder(get(), roomCode, playback, playback.server_now)) return false;
    set({ roomCode, playback, lastServerNow: playback.server_now });
    return true;
  },

  setClockOffset: (roomCode, clockOffsetMs) => {
    if (get().roomCode === roomCode) set({ clockOffsetMs });
  },

  reset: () => set({ roomCode: null, playback: null, lastServerNow: null, clockOffsetMs: 0 }),
}));
