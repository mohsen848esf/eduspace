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
  maxParticipants: number;
  durationLimitMinutes: number | null;
  isDurationLimited: boolean;
  startedAt: string | null;
  mutedByHost: Set<string>;
  setMutedByHost: (identity: string, muted: boolean) => void;
  setRoomSettings: (settings: {
    requireApproval?: boolean;
    isLocked?: boolean;
    maxParticipants?: number;
    durationLimitMinutes?: number | null;
    isDurationLimited?: boolean;
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
    maxParticipants?: number;
    durationLimitMinutes?: number | null;
    isDurationLimited?: boolean;
    startedAt?: string | null;
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
  maxParticipants: 25,
  durationLimitMinutes: 60,
  isDurationLimited: true,
  startedAt: null,
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
      maxParticipants:
        settings.maxParticipants !== undefined
          ? settings.maxParticipants
          : state.maxParticipants,
      durationLimitMinutes:
        settings.durationLimitMinutes !== undefined
          ? settings.durationLimitMinutes
          : state.durationLimitMinutes,
      isDurationLimited:
        settings.isDurationLimited !== undefined
          ? settings.isDurationLimited
          : state.isDurationLimited,
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
      maxParticipants: data.maxParticipants || 25,
      durationLimitMinutes: data.durationLimitMinutes !== undefined ? data.durationLimitMinutes : 60,
      isDurationLimited: data.isDurationLimited !== undefined ? data.isDurationLimited : true,
      startedAt: data.startedAt || null,
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
      maxParticipants: 25,
      durationLimitMinutes: 60,
      isDurationLimited: true,
      startedAt: null,
    }),
}));

