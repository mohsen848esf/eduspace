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
  is_link_shared?: boolean;
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
  // Resume position for the requesting non-owner viewer (0 if none yet).
  last_position_seconds?: number;
  // For owner only: distinct number of non-owner users who have heartbeated.
  viewer_count?: number;
}

export interface RecordingViewer {
  user_id: number;
  username: string;
  full_name: string;
  last_position_seconds: number;
  furthest_position_seconds: number;
  view_count: number;
  first_watched_at: string;
  last_watched_at: string;
  /** 0..1 ratio of furthest_position_seconds / duration_seconds. */
  completion_ratio: number;
}

export interface RoomRecordingStatus {
  status: "idle" | RecordingStatus;
  recording: Recording | null;
}

/**
 * Shape returned by GET /rooms/<code>/recording/permission/.
 *
 * Every participant can read their own slice — `can_control` reflects
 * whether the *requesting* user may drive the record buttons. Only the
 * host gets the populated `grants` array; for everyone else it's null.
 */
export interface RecordingGrantUser {
  user_id: number;
  username: string;
  full_name: string;
}

export interface RoomRecordingPermission {
  can_control: boolean;
  is_host: boolean;
  grants: RecordingGrantUser[] | null;
}

/**
 * Shape returned by POST /rooms/<code>/recording/permission/set/.
 */
export interface RecordingGrantUpdate {
  user_id: number;
  username: string;
  full_name: string;
  granted: boolean;
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

  startClient: async (
    roomCode: string,
    quality: RecordingQuality,
  ): Promise<Recording> => {
    const res = await client.post(`/rooms/${roomCode}/recording/start-client/`, {
      quality,
    });
    return res.data;
  },

  uploadChunk: async (
    token: string,
    chunk: Blob,
    index: number,
  ): Promise<{ success: boolean; index: number }> => {
    const formData = new FormData();
    formData.append("chunk", chunk, `chunk_${index}.webm`);
    formData.append("index", String(index));
    const res = await client.post(`/recordings/${token}/upload-chunk/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  completeClient: async (token: string): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/complete-client/`);
    return res.data;
  },

  roomStatus: async (roomCode: string): Promise<RoomRecordingStatus> => {
    const res = await client.get(`/rooms/${roomCode}/recording/status/`);
    return res.data;
  },

  /**
   * Read who can control recording in this room. Anyone who is a
   * participant can call this; the response shows their own permission
   * (`can_control`) and, if they're the host, the list of currently
   * authorized non-host participants.
   */
  getRecordingPermission: async (
    roomCode: string,
  ): Promise<RoomRecordingPermission> => {
    const res = await client.get(`/rooms/${roomCode}/recording/permission/`);
    return res.data;
  },

  /**
   * Host-only — grant or revoke a participant's recording control.
   *
   * The participant can be addressed by either user_id (preferred, when
   * we have it) or username (the LiveKit identity, which is what the
   * in-call participants panel has on hand).
   */
  setRecordingPermission: async (
    roomCode: string,
    target: { userId?: number; username?: string },
    granted: boolean,
  ): Promise<RecordingGrantUpdate> => {
    const body: Record<string, unknown> = { granted };
    if (target.userId !== undefined) body.user_id = target.userId;
    if (target.username !== undefined) body.username = target.username;
    const res = await client.post(
      `/rooms/${roomCode}/recording/permission/set/`,
      body,
    );
    return res.data;
  },

  // ── Library (read-side) ───────────────────────────────────────────────
  list: async (params?: {
    room_code?: string;
    status?: RecordingStatus;
    published?: boolean;
    q?: string;
  }): Promise<{ count: number; results: Recording[] }> => {
    const res = await client.get("/recordings/", {
      params: {
        ...(params?.room_code ? { room_code: params.room_code } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.published !== undefined
          ? { published: params.published }
          : {}),
        ...(params?.q ? { q: params.q } : {}),
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

  publish: async (
    token: string,
    userIds: number[],
    opts: { isLinkShared?: boolean } = {},
  ): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/publish/`, {
      user_ids: userIds,
      ...(opts.isLinkShared !== undefined
        ? { is_link_shared: opts.isLinkShared }
        : {}),
    });
    return res.data;
  },

  unpublish: async (token: string): Promise<Recording> => {
    const res = await client.post(`/recordings/${token}/unpublish/`);
    return res.data;
  },

  // ── Watch tracking ────────────────────────────────────────────────────
  /**
   * Lightweight ping the player fires every few seconds while the user
   * is watching. Server clamps and stores last/furthest position. Owner
   * heartbeats are silently dropped (response: { ignored: 'owner' }).
   */
  heartbeat: async (
    token: string,
    positionSeconds: number,
  ): Promise<{
    last_position_seconds?: number;
    furthest_position_seconds?: number;
    view_count?: number;
    ignored?: string;
  }> => {
    const res = await client.post(`/recordings/${token}/heartbeat/`, {
      position_seconds: positionSeconds,
    });
    return res.data;
  },

  /**
   * Host-only analytics: list every non-owner viewer with their progress,
   * completion ratio, last-watched timestamp, and session count.
   */
  getViews: async (
    token: string,
  ): Promise<{ count: number; results: RecordingViewer[] }> => {
    const res = await client.get(`/recordings/${token}/views/`);
    return res.data;
  },

  // ── Stream URL helper ─────────────────────────────────────────────────
  // Stream needs a Bearer JWT; the browser <video src> tag won't send it.
  // We hand the URL to RecordingPlayer.tsx which wires fetch + Blob URL.
  streamUrl: (token: string) =>
    `${client.defaults.baseURL}/recordings/${token}/stream/`,

  // Public-facing watch URL we copy into the user's clipboard when the
  // owner enables link-sharing on a recording.
  watchUrl: (token: string) =>
    `${window.location.origin}/recordings/${token}`,
};

export default recordingsApi;

// Convenience: also exposed as a named function so tests don't need
// the default-export indirection.
export const recordingsApi_ = recordingsApi;
