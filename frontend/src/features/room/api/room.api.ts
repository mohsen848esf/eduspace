import client from "../../../lib/api/client";
import type {
  CreateRoomInput,
  RoomResponse,
  RoomInfo,
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
  ): Promise<LobbyStatusResponse> => {
    const res = await client.get(
      `/rooms/${room_code}/lobby/status/${request_id}/`,
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
};

