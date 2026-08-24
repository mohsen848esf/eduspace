import { create } from "zustand";
import type { PresentationDocument } from "../schemas/room.schema";

interface RoomState {
  token: string | null;
  livekitUrl: string | null;
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;
  isCoHost: boolean;
  coHosts: string[];
  isGuest: boolean;
  guestIdentity: string | null;
  requireApproval: boolean;
  isLocked: boolean;
  maxParticipants: number;
  durationLimitMinutes: number | null;
  isDurationLimited: boolean;
  startedAt: string | null;
  muteMicOnJoin: boolean;
  muteCamOnJoin: boolean;
  lockScreenShare: boolean;
  lockMicrophone: boolean;
  lockCamera: boolean;
  lockDocumentPresentation: boolean;
  canShareScreen: boolean;
  canUseCamera: boolean;
  canUseMicrophone: boolean;
  canUploadPresentation: boolean;
  activePresentation: PresentationDocument | null;
  isPresentationMinimized: boolean;
  isUserLeaving: boolean;
  presentationsList: PresentationDocument[];
  mutedByHost: Set<string>;
  setMutedByHost: (identity: string, muted: boolean) => void;
  setIsCoHost: (isCoHost: boolean) => void;
  setCoHosts: (coHosts: string[]) => void;
  addCoHost: (identity: string) => void;
  removeCoHost: (identity: string) => void;
  setIsUserLeaving: (isLeaving: boolean) => void;
  setActivePresentation: (doc: PresentationDocument | null) => void;
  setIsPresentationMinimized: (minimized: boolean) => void;
  setPresentationsList: (list: PresentationDocument[]) => void;
  setPresentationCurrentPage: (page: number) => void;
  setMediaPermissions: (perms: {
    canShareScreen?: boolean;
    canUseCamera?: boolean;
    canUseMicrophone?: boolean;
    canUploadPresentation?: boolean;
  }) => void;
  setRoomSettings: (settings: {
    requireApproval?: boolean;
    isLocked?: boolean;
    maxParticipants?: number;
    durationLimitMinutes?: number | null;
    isDurationLimited?: boolean;
    muteMicOnJoin?: boolean;
    muteCamOnJoin?: boolean;
    lockScreenShare?: boolean;
    lockMicrophone?: boolean;
    lockCamera?: boolean;
    lockDocumentPresentation?: boolean;
  }) => void;

  setRoom: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    roomName: string;
    isHost: boolean;
    isCoHost?: boolean;
    coHosts?: string[];
    isGuest?: boolean;
    guestIdentity?: string | null;
    requireApproval?: boolean;
    isLocked?: boolean;
    maxParticipants?: number;
    durationLimitMinutes?: number | null;
    isDurationLimited?: boolean;
    startedAt?: string | null;
    muteMicOnJoin?: boolean;
    muteCamOnJoin?: boolean;
    lockScreenShare?: boolean;
    lockMicrophone?: boolean;
    lockCamera?: boolean;
    lockDocumentPresentation?: boolean;
    canShareScreen?: boolean;
    canUseCamera?: boolean;
    canUseMicrophone?: boolean;
    canUploadPresentation?: boolean;
    activePresentation?: PresentationDocument | null;
  }) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  token: null,
  livekitUrl: null,
  roomCode: null,
  roomName: null,
  isHost: false,
  isCoHost: false,
  coHosts: [],
  isGuest: false,
  guestIdentity: null,
  requireApproval: false,
  isLocked: false,
  maxParticipants: 25,
  durationLimitMinutes: 60,
  isDurationLimited: true,
  startedAt: null,
  muteMicOnJoin: false,
  muteCamOnJoin: false,
  lockScreenShare: false,
  lockMicrophone: false,
  lockCamera: false,
  lockDocumentPresentation: true,
  canShareScreen: true,
  canUseCamera: true,
  canUseMicrophone: true,
  canUploadPresentation: false,
  activePresentation: null,
  isPresentationMinimized: false,
  isUserLeaving: false,
  presentationsList: [],
  mutedByHost: new Set<string>(),
  setMutedByHost: (identity, muted) =>
    set((state) => {
      const updated = new Set(state.mutedByHost);
      if (muted) updated.add(identity);
      else updated.delete(identity);
      return { mutedByHost: updated };
    }),
  setIsCoHost: (isCoHost) => set({ isCoHost }),
  setCoHosts: (coHosts) => set({ coHosts }),
  addCoHost: (identity) =>
    set((state) => ({
      coHosts: state.coHosts.includes(identity)
        ? state.coHosts
        : [...state.coHosts, identity],
    })),
  removeCoHost: (identity) =>
    set((state) => ({
      coHosts: state.coHosts.filter((h) => h !== identity),
    })),
  setIsUserLeaving: (isUserLeaving) => set({ isUserLeaving }),
  setActivePresentation: (doc) =>
    set({ activePresentation: doc, isPresentationMinimized: false }),
  setIsPresentationMinimized: (minimized) =>
    set({ isPresentationMinimized: minimized }),
  setPresentationsList: (list) => set({ presentationsList: list }),
  setPresentationCurrentPage: (page) =>
    set((state) => {
      if (!state.activePresentation) return state;
      return {
        activePresentation: {
          ...state.activePresentation,
          current_page: page,
        },
      };
    }),
  setMediaPermissions: (perms) =>
    set((state) => ({
      canShareScreen:
        perms.canShareScreen !== undefined
          ? perms.canShareScreen
          : state.canShareScreen,
      canUseCamera:
        perms.canUseCamera !== undefined
          ? perms.canUseCamera
          : state.canUseCamera,
      canUseMicrophone:
        perms.canUseMicrophone !== undefined
          ? perms.canUseMicrophone
          : state.canUseMicrophone,
      canUploadPresentation:
        perms.canUploadPresentation !== undefined
          ? perms.canUploadPresentation
          : state.canUploadPresentation,
    })),
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
      muteMicOnJoin:
        settings.muteMicOnJoin !== undefined
          ? settings.muteMicOnJoin
          : state.muteMicOnJoin,
      muteCamOnJoin:
        settings.muteCamOnJoin !== undefined
          ? settings.muteCamOnJoin
          : state.muteCamOnJoin,
      lockScreenShare:
        settings.lockScreenShare !== undefined
          ? settings.lockScreenShare
          : state.lockScreenShare,
      lockMicrophone:
        settings.lockMicrophone !== undefined
          ? settings.lockMicrophone
          : state.lockMicrophone,
      lockCamera:
        settings.lockCamera !== undefined
          ? settings.lockCamera
          : state.lockCamera,
      lockDocumentPresentation:
        settings.lockDocumentPresentation !== undefined
          ? settings.lockDocumentPresentation
          : state.lockDocumentPresentation,
    })),
  setRoom: (data) =>
    set({
      token: data.token,
      livekitUrl: data.livekitUrl,
      roomCode: data.roomCode,
      roomName: data.roomName,
      isHost: data.isHost,
      isCoHost: data.isCoHost || false,
      coHosts: data.coHosts || [],
      isGuest: data.isGuest || false,
      guestIdentity: data.guestIdentity || null,
      requireApproval: data.requireApproval || false,
      isLocked: data.isLocked || false,
      maxParticipants: data.maxParticipants || 25,
      durationLimitMinutes: data.durationLimitMinutes !== undefined ? data.durationLimitMinutes : 60,
      isDurationLimited: data.isDurationLimited !== undefined ? data.isDurationLimited : true,
      startedAt: data.startedAt || null,
      muteMicOnJoin: data.muteMicOnJoin || false,
      muteCamOnJoin: data.muteCamOnJoin || false,
      lockScreenShare: data.lockScreenShare || false,
      lockMicrophone: data.lockMicrophone || false,
      lockCamera: data.lockCamera || false,
      lockDocumentPresentation: data.lockDocumentPresentation !== undefined ? data.lockDocumentPresentation : true,
      canShareScreen: data.canShareScreen !== undefined ? data.canShareScreen : true,
      canUseCamera: data.canUseCamera !== undefined ? data.canUseCamera : true,
      canUseMicrophone: data.canUseMicrophone !== undefined ? data.canUseMicrophone : true,
      canUploadPresentation: data.canUploadPresentation !== undefined ? data.canUploadPresentation : (data.isHost || data.isCoHost || false),
      activePresentation: data.activePresentation || null,
    }),
  clearRoom: () =>
    set({
      token: null,
      livekitUrl: null,
      roomCode: null,
      roomName: null,
      isHost: false,
      isCoHost: false,
      coHosts: [],
      isGuest: false,
      guestIdentity: null,
      requireApproval: false,
      isLocked: false,
      maxParticipants: 25,
      durationLimitMinutes: 60,
      isDurationLimited: true,
      startedAt: null,
      muteMicOnJoin: false,
      muteCamOnJoin: false,
      lockScreenShare: false,
      lockMicrophone: false,
      lockCamera: false,
      lockDocumentPresentation: true,
      canShareScreen: true,
      canUseCamera: true,
      canUseMicrophone: true,
      canUploadPresentation: false,
      activePresentation: null,
      isPresentationMinimized: false,
      isUserLeaving: false,
      presentationsList: [],
    }),
}));

