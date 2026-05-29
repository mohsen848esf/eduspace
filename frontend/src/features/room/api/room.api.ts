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

export const roomApi = {
  create: async (data: CreateRoomInput): Promise<RoomResponse> => {
    const res = await client.post("/rooms/create/", data);
    return res.data;
  },

  join: async (room_code: string): Promise<RoomResponse> => {
    const res = await client.post(`/rooms/${room_code}/join/`);
    return res.data;
  },

  leave: async (room_code: string): Promise<void> => {
    await client.post(`/rooms/${room_code}/leave/`);
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
};
