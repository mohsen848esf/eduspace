import client from "../../../lib/api/client";

export type RecordingStatus =
  | "starting"
  | "recording"
  | "paused"
  | "processing"
  | "completed"
  | "failed";

export type RecordingQuality = "720p" | "1080p";

export interface Recording {
  public_token: string;
  status: RecordingStatus;
  quality: RecordingQuality;
  duration_seconds: number;
  size_bytes: number;
  started_at: string;
  completed_at: string | null;
  is_published: boolean;
  segment_count: number;
  // present in detail / list responses
  room_code?: string;
  room_name?: string;
  owner_username?: string;
  owner_full_name?: string;
  is_owner?: boolean;
  published_at?: string | null;
  trim_start_seconds?: number;
  trim_end_seconds?: number | null;
  shared_with?: { id: number; username: string; full_name: string }[];
}

export interface RoomRecordingStatus {
  status: "idle" | RecordingStatus;
  recording: Recording | null;
}

const recordingsApi = {
  // ── In-room control plane ─────────────────────────────────────────────
  start: async (
    roomCode: string,
    quality: RecordingQuality,
  ): Promise<Recording> => {
    const res = await client.post(`/rooms/${roomCode}/recording/start/`, {
      quality,
    });
    return res.data;
  },

  stop: async (roomCode: string): Promise<Recording> => {
    const res = await client.post(`/rooms/${roomCode}/recording/stop/`);
    return res.data;
  },

  pause: async (roomCode: string): Promise<Recording> => {
    const res = await client.post(`/rooms/${roomCode}/recording/pause/`);
    return res.data;
  },

  resume: async (roomCode: string): Promise<Recording> => {
    const res = await client.post(`/rooms/${roomCode}/recording/resume/`);
    return res.data;
  },

  roomStatus: async (roomCode: string): Promise<RoomRecordingStatus> => {
    const res = await client.get(`/rooms/${roomCode}/recording/status/`);
    return res.data;
  },

  // ── Library (read-side) ───────────────────────────────────────────────
  list: async (params?: {
    room_code?: string;
    status?: RecordingStatus;
    published?: boolean;
  }): Promise<{ count: number; results: Recording[] }> => {
    const res = await client.get("/recordings/", {
      params: {
        ...(params?.room_code ? { room_code: params.room_code } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.published !== undefined
          ? { published: params.published }
          : {}),
      },
    });
    return res.data;
  },

  detail: async (token: string): Promise<Recording> => {
    const res = await client.get(`/recordings/${token}/`);
    return res.data;
  },

  remove: async (token: string): Promise<void> => {
    await client.delete(`/recordings/${token}/`);
  },

  // ── Editing & sharing ─────────────────────────────────────────────────
  finalize: async (
    token: string,
    bounds: { trim_start_seconds?: number; trim_end_seconds?: number | null },
  ): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/finalize/`, {
      trim_start_seconds: bounds.trim_start_seconds ?? 0,
      trim_end_seconds: bounds.trim_end_seconds ?? null,
    });
    return res.data;
  },

  publish: async (token: string, userIds: number[]): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/publish/`, {
      user_ids: userIds,
    });
    return res.data;
  },

  unpublish: async (token: string): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/unpublish/`);
    return res.data;
  },

  // ── Stream URL helper ─────────────────────────────────────────────────
  // Stream needs a Bearer JWT; the browser <video src> tag won't send it.
  // We hand the URL to RecordingPlayer.tsx which wires fetch + Blob URL.
  streamUrl: (token: string) =>
    `${client.defaults.baseURL}/recordings/${token}/stream/`,
};

export default recordingsApi;
