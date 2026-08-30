import { z } from "zod";

const participantCapabilitiesSchema = z.object({
  can_share_screen: z.boolean(),
  can_use_microphone: z.boolean(),
  can_use_camera: z.boolean(),
  can_upload_presentation: z.boolean(),
});

export const roomPermissionSnapshotSchema = participantCapabilitiesSchema.extend({
  room_code: z.string(),
  identity: z.string(),
  host_identity: z.string(),
  co_hosts: z.array(z.string()),
  is_host: z.boolean(),
  is_co_host: z.boolean(),
  lock_screen_share: z.boolean(),
  lock_microphone: z.boolean(),
  lock_camera: z.boolean(),
  lock_document_presentation: z.boolean(),
  participants: z.array(participantCapabilitiesSchema.extend({ identity: z.string() })),
});

export type RoomPermissionSnapshot = z.infer<typeof roomPermissionSnapshotSchema>;
export type RoomPermission = "screen_share" | "microphone" | "camera" | "presentation_upload";

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

export interface PresentationDocument {
  id: number;
  title: string;
  file_url: string;
  file_type: "pdf" | "image" | "slide" | "other";
  source_type?: "pdf" | "png" | "jpeg" | "webp" | "ppt" | "pptx" | "odp" | "doc" | "docx";
  file_size_bytes?: number;
  total_pages: number;
  current_page: number;
  uploader_name: string;
  is_active_on_stage?: boolean;
  processing_status: "pending" | "processing" | "ready" | "failed";
  processing_error_code?: string;
  created_at?: string;
}

export interface RoomResponse {
  room_code: string;
  name: string;
  token: string;
  livekit_url: string;
  is_host?: boolean;
  is_co_host?: boolean;
  is_guest?: boolean;
  guest_identity?: string;
  guest_access_token?: string;
  require_approval?: boolean;
  is_locked?: boolean;
  max_participants?: number;
  duration_limit_minutes?: number | null;
  is_duration_limited?: boolean;
  mute_mic_on_join?: boolean;
  mute_cam_on_join?: boolean;
  lock_screen_share?: boolean;
  lock_microphone?: boolean;
  lock_camera?: boolean;
  lock_document_presentation?: boolean;
  can_share_screen?: boolean;
  can_use_camera?: boolean;
  can_use_microphone?: boolean;
  can_upload_presentation?: boolean;
}

export interface RoomInfo {
  room_code: string;
  name: string;
  status: "waiting" | "active" | "ended";
  host: string;
  co_hosts?: string[];
  participants: {
    user__username: string;
    user__full_name: string;
    role: "host" | "co_host" | "participant" | "guest";
    is_guest?: boolean;
    can_share_screen?: boolean;
    can_use_camera?: boolean;
    can_use_microphone?: boolean;
    can_upload_presentation?: boolean;
  }[];
  max_participants: number;
  duration_limit_minutes?: number | null;
  is_duration_limited?: boolean;
  is_recorded: boolean;
  require_approval?: boolean;
  is_locked?: boolean;
  mute_mic_on_join?: boolean;
  mute_cam_on_join?: boolean;
  lock_screen_share?: boolean;
  lock_microphone?: boolean;
  lock_camera?: boolean;
  lock_document_presentation?: boolean;
}
