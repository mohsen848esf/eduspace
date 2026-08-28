import client from "../../../lib/api/client";
import type {
  CreateRoomInput,
  RoomResponse,
  RoomInfo,
  PresentationDocument,
} from "../schemas/room.schema";

export interface RoomParticipantHistoryItem {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

// Returned by join/guest-join when room.require_approval=True
export interface LobbyWaitingResponse {
  waiting: true;
  request_id: number;
  room_code: string;
  name: string;
  guest_identity?: string; // only for guests
  guest_access_token?: string; // signed, room-scoped guest REST credential
}

// Returned by lobby/status/<id>/
export interface LobbyStatusResponse {
  status: "pending" | "admitted" | "denied" | "expired" | "room_ended";
  room_code: string;
  name: string;
  // Only when status === "admitted"
  token?: string;
  livekit_url?: string;
  is_guest?: boolean;
  guest_identity?: string;
  guest_access_token?: string;
  lock_document_presentation?: boolean;
  can_upload_presentation?: boolean;
}

export interface LobbyRequest {
  id: number;
  display_name: string;
  is_guest: boolean;
  waiting_since: string;
}

export interface LobbyListResponse {
  count: number;
  requests: LobbyRequest[];
}

export interface RoomAccessSettings {
  require_approval: boolean;
  is_locked: boolean;
  mute_mic_on_join?: boolean;
  mute_cam_on_join?: boolean;
  lock_screen_share?: boolean;
  lock_microphone?: boolean;
  lock_camera?: boolean;
  lock_document_presentation?: boolean;
}

// join/guest-join can return either direct entry or lobby waiting
export type JoinResponse = RoomResponse | LobbyWaitingResponse;

export const roomApi = {
  create: async (data: CreateRoomInput): Promise<RoomResponse> => {
    const res = await client.post("/rooms/create/", data);
    return res.data;
  },

  join: async (room_code: string): Promise<JoinResponse> => {
    const res = await client.post(`/rooms/${room_code}/join/`);
    return res.data;
  },

  guestJoin: async (
    room_code: string,
    display_name: string,
  ): Promise<JoinResponse> => {
    const res = await client.post(`/rooms/${room_code}/guest-join/`, {
      display_name,
    });
    return res.data;
  },

  leave: async (room_code: string, guest_identity?: string): Promise<void> => {
    await client.post(`/rooms/${room_code}/leave/`, {
      guest_identity,
    });
  },

  getRoom: async (room_code: string): Promise<RoomInfo> => {
    const res = await client.get(`/rooms/${room_code}/`);
    return res.data;
  },

  participantsHistory: async (
    room_code: string,
  ): Promise<{ count: number; results: RoomParticipantHistoryItem[] }> => {
    const res = await client.get(`/rooms/${room_code}/participants-history/`);
    return res.data;
  },

  // --- Lobby ---
  lobbyList: async (room_code: string): Promise<LobbyListResponse> => {
    const res = await client.get(`/rooms/${room_code}/lobby/`);
    return res.data;
  },

  lobbyStatus: async (
    room_code: string,
    request_id: number,
    guest_access_token?: string | null,
  ): Promise<LobbyStatusResponse> => {
    const res = await client.get(
      `/rooms/${room_code}/lobby/status/${request_id}/`,
      guest_access_token
        ? { headers: { "X-Guest-Access-Token": guest_access_token } }
        : undefined,
    );
    return res.data;
  },

  lobbyAdmit: async (room_code: string, request_id: number): Promise<void> => {
    await client.post(`/rooms/${room_code}/lobby/${request_id}/admit/`);
  },

  lobbyDeny: async (room_code: string, request_id: number): Promise<void> => {
    await client.post(`/rooms/${room_code}/lobby/${request_id}/deny/`);
  },

  lobbyAdmitAll: async (room_code: string): Promise<void> => {
    await client.post(`/rooms/${room_code}/lobby/admit-all/`);
  },

  lobbyDenyAll: async (room_code: string): Promise<void> => {
    await client.post(`/rooms/${room_code}/lobby/deny-all/`);
  },

  // --- Room Access Settings ---
  updateSettings: async (
    room_code: string,
    settings: Partial<RoomAccessSettings>,
  ): Promise<RoomAccessSettings & { room_code: string }> => {
    const res = await client.patch(`/rooms/${room_code}/settings/`, settings);
    return res.data;
  },

  // --- Co-Hosts ---
  listCoHosts: async (
    room_code: string,
  ): Promise<{ co_hosts: { id: number; username: string; full_name: string }[] }> => {
    const res = await client.get(`/rooms/${room_code}/co-hosts/`);
    return res.data;
  },

  grantCoHost: async (
    room_code: string,
    username: string,
  ): Promise<{ message: string; co_hosts: string[] }> => {
    const res = await client.post(`/rooms/${room_code}/co-hosts/grant/`, { username });
    return res.data;
  },

  revokeCoHost: async (
    room_code: string,
    username: string,
  ): Promise<{ message: string; co_hosts: string[] }> => {
    const res = await client.post(`/rooms/${room_code}/co-hosts/revoke/`, { username });
    return res.data;
  },

  // --- Media Permissions ---
  grantMediaPermission: async (
    room_code: string,
    identity: string,
    permission_type: "screen_share" | "microphone" | "camera",
    granted: boolean = true,
  ): Promise<{ message: string; participant: string; permission_type: string; granted: boolean }> => {
    const res = await client.post(`/rooms/${room_code}/grant-media-permission/`, {
      identity,
      permission_type,
      granted,
    });
    return res.data;
  },

  // --- Presentations & Documents ---
  uploadPresentation: async (
    room_code: string,
    formData: FormData,
    guest_access_token?: string | null,
  ): Promise<PresentationDocument> => {
    const res = await client.post(`/rooms/${room_code}/presentations/upload/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(guest_access_token
          ? { "X-Guest-Access-Token": guest_access_token }
          : {}),
      },
    });
    return res.data;
  },

  listPresentations: async (
    room_code: string,
  ): Promise<{ presentations: PresentationDocument[] }> => {
    const res = await client.get(`/rooms/${room_code}/presentations/`);
    return res.data;
  },

  setActivePresentation: async (
    room_code: string,
    docId: number,
    isActive: boolean = true,
    guest_access_token?: string | null,
  ): Promise<PresentationDocument | { message: string; is_active: boolean }> => {
    const res = await client.post(`/rooms/${room_code}/presentations/${docId}/present/`, {
      is_active: isActive,
    }, guest_access_token
      ? { headers: { "X-Guest-Access-Token": guest_access_token } }
      : undefined);
    return res.data;
  },

  setPresentationPage: async (
    room_code: string,
    docId: number,
    page: number,
    guest_access_token?: string | null,
  ): Promise<{ id: number; current_page: number; total_pages: number }> => {
    const res = await client.post(`/rooms/${room_code}/presentations/${docId}/page/`, {
      page,
    }, guest_access_token
      ? { headers: { "X-Guest-Access-Token": guest_access_token } }
      : undefined);
    return res.data;
  },

  retryPresentationConversion: async (
    room_code: string,
    docId: number,
    guest_access_token?: string | null,
  ): Promise<PresentationDocument> => {
    const res = await client.post(
      `/rooms/${room_code}/presentations/${docId}/retry/`,
      {},
      guest_access_token
        ? { headers: { "X-Guest-Access-Token": guest_access_token } }
        : undefined,
    );
    return res.data;
  },

  grantPresentationPermission: async (
    room_code: string,
    identity: string,
    granted: boolean = true,
  ): Promise<{ message: string; participant: string; granted: boolean }> => {
    const res = await client.post(`/rooms/${room_code}/grant-presentation-permission/`, {
      identity,
      granted,
    });
    return res.data;
  },
};

