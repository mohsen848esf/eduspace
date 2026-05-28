import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(2, "Room name must be at least 2 characters"),
  max_participants: z.number().min(2).max(20).default(20),
  is_recorded: z.boolean().default(false),
});

export const joinRoomSchema = z.object({
  room_code: z
    .string()
    .length(6, "Room code must be 6 characters")
    .toUpperCase(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export interface RoomResponse {
  room_code: string;
  name: string;
  token: string;
  livekit_url: string;
  is_host?: boolean;
}

export interface RoomInfo {
  room_code: string;
  name: string;
  status: "waiting" | "active" | "ended";
  host: string;
  participants: {
    user__username: string;
    user__full_name: string;
    role: "host" | "participant";
  }[];
  max_participants: number;
  is_recorded: boolean;
}
