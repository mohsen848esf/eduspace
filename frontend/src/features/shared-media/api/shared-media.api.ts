import client from "@/lib/api/client";
import {
  mediaAssetListSchema,
  mediaAssetSchema,
  mediaUploadSessionSchema,
  mediaUploadResumeStateSchema,
  progressiveMediaChunkSchema,
  progressiveMediaUploadSchema,
  progressiveUploadCapabilitySchema,
  progressiveUploadStateSchema,
  playbackHistorySchema,
  sharedPlaybackSchema,
  sharedPlaybackDeliverySchema,
  sharedPlaybackSnapshotSchema,
  signedUploadPartSchema,
  signedProgressiveChunkSchema,
  successEnvelopeSchema,
  type MediaAsset,
  type MediaUploadSession,
  type ProgressiveMediaUpload,
  type SharedPlayback,
  type SharedPlaybackSnapshot,
} from "../schemas/shared-media.schema";

export interface SharedPlaybackCommand {
  command: "PLAY" | "PAUSE" | "SEEK" | "BUFFERING" | "STOP" | "SET_SYNC_POLICY";
  expected_version: number;
  position_ms?: number | null;
  lead_time_ms?: number;
  playback_rate?: string;
  sync_policy?: "continuous" | "strict";
  buffer_reason?: "frontier" | "readiness";
}

const parseData = <T>(schema: { parse: (value: unknown) => { data: T } }, value: unknown): T =>
  schema.parse(value).data;

export const sharedMediaApi = {
  getProgressiveUploadCapability: async () => {
    const response = await client.get("/media/progressive-upload/capability/");
    return parseData(successEnvelopeSchema(progressiveUploadCapabilitySchema), response.data);
  },

  listAssets: async (params?: { status?: string; q?: string }) => {
    const response = await client.get("/media/assets/", { params });
    return parseData(successEnvelopeSchema(mediaAssetListSchema), response.data);
  },

  createAsset: async (input: {
    title: string;
    original_filename?: string;
  }): Promise<MediaAsset> => {
    const response = await client.post("/media/assets/", input);
    return parseData(successEnvelopeSchema(mediaAssetSchema), response.data);
  },

  getAsset: async (publicToken: string): Promise<MediaAsset> => {
    const response = await client.get(`/media/assets/${publicToken}/`);
    return parseData(successEnvelopeSchema(mediaAssetSchema), response.data);
  },

  deleteAsset: async (publicToken: string): Promise<void> => {
    await client.delete(`/media/assets/${publicToken}/`);
  },

  getHistory: async (publicToken: string) => {
    const response = await client.get(`/media/assets/${publicToken}/history/`);
    return parseData(successEnvelopeSchema(playbackHistorySchema), response.data);
  },

  initiateUpload: async (
    publicToken: string,
    input: { size_bytes: number; content_type: string },
  ): Promise<MediaUploadSession> => {
    const response = await client.post(
      `/media/assets/${publicToken}/uploads/initiate/`,
      input,
    );
    return parseData(successEnvelopeSchema(mediaUploadSessionSchema), response.data);
  },

  getUploadStatus: async (publicToken: string, uploadToken: string) => {
    const response = await client.get(
      `/media/assets/${publicToken}/uploads/${uploadToken}/`,
    );
    return parseData(successEnvelopeSchema(mediaUploadResumeStateSchema), response.data);
  },

  signUploadPart: async (
    publicToken: string,
    uploadToken: string,
    partNumber: number,
  ) => {
    const response = await client.post(
      `/media/assets/${publicToken}/uploads/${uploadToken}/parts/`,
      { part_number: partNumber },
    );
    return parseData(successEnvelopeSchema(signedUploadPartSchema), response.data);
  },

  uploadPart: async (
    uploadUrl: string,
    chunk: Blob,
    signal?: AbortSignal,
  ): Promise<string> => {
    const response = await fetch(uploadUrl, { method: "PUT", body: chunk, signal });
    if (!response.ok) throw new Error(`Upload part failed with HTTP ${response.status}.`);
    const etag = response.headers.get("ETag");
    if (!etag) throw new Error("Object storage did not expose the ETag response header.");
    return etag;
  },

  completeUpload: async (
    publicToken: string,
    uploadToken: string,
    parts: Array<{ part_number: number; etag: string }>,
  ): Promise<MediaUploadSession> => {
    const response = await client.post(
      `/media/assets/${publicToken}/uploads/${uploadToken}/complete/`,
      { parts },
    );
    return parseData(successEnvelopeSchema(mediaUploadSessionSchema), response.data);
  },

  initiateProgressiveUpload: async (
    publicToken: string,
    input: { size_bytes: number; content_type: string },
  ): Promise<ProgressiveMediaUpload> => {
    const response = await client.post(
      `/media/assets/${publicToken}/progressive-uploads/initiate/`, input,
    );
    return parseData(successEnvelopeSchema(progressiveMediaUploadSchema), response.data);
  },

  getProgressiveUploadStatus: async (publicToken: string, uploadToken: string) => {
    const response = await client.get(
      `/media/assets/${publicToken}/progressive-uploads/${uploadToken}/`,
    );
    return parseData(successEnvelopeSchema(progressiveUploadStateSchema), response.data);
  },

  signProgressiveChunk: async (publicToken: string, uploadToken: string, sequence: number) => {
    const response = await client.post(
      `/media/assets/${publicToken}/progressive-uploads/${uploadToken}/chunks/sign/`,
      { sequence },
    );
    return parseData(successEnvelopeSchema(signedProgressiveChunkSchema), response.data);
  },

  uploadProgressiveChunk: async (uploadUrl: string, chunk: Blob, signal?: AbortSignal) => {
    const response = await fetch(uploadUrl, { method: "PUT", body: chunk, signal });
    if (!response.ok) throw new Error(`Chunk upload failed with HTTP ${response.status}.`);
    const etag = response.headers.get("ETag");
    if (!etag) throw new Error("Object storage did not expose the ETag response header.");
    return etag;
  },

  commitProgressiveChunk: async (
    publicToken: string,
    uploadToken: string,
    input: { sequence: number; etag: string; checksum_sha256: string },
  ) => {
    const response = await client.post(
      `/media/assets/${publicToken}/progressive-uploads/${uploadToken}/chunks/commit/`, input,
    );
    return parseData(successEnvelopeSchema(progressiveMediaChunkSchema), response.data);
  },

  completeProgressiveUpload: async (
    publicToken: string,
    uploadToken: string,
  ): Promise<ProgressiveMediaUpload> => {
    const response = await client.post(
      `/media/assets/${publicToken}/progressive-uploads/${uploadToken}/complete/`,
    );
    return parseData(successEnvelopeSchema(progressiveMediaUploadSchema), response.data);
  },

  openPlayback: async (
    roomCode: string,
    input: {
      asset_public_token: string;
      resumed_from_id?: number | null;
      start_position_ms?: number | null;
    },
  ): Promise<SharedPlayback> => {
    const response = await client.post(`/rooms/${roomCode}/shared-playback/open/`, input);
    return parseData(successEnvelopeSchema(sharedPlaybackSchema), response.data);
  },

  commandPlayback: async (
    roomCode: string,
    command: SharedPlaybackCommand,
  ): Promise<SharedPlayback> => {
    const response = await client.post(
      `/rooms/${roomCode}/shared-playback/command/`,
      command,
    );
    return parseData(successEnvelopeSchema(sharedPlaybackSchema), response.data);
  },

  getSnapshot: async (
    roomCode: string,
    guestAccessToken?: string,
  ): Promise<SharedPlaybackSnapshot> => {
    const response = await client.get(`/rooms/${roomCode}/shared-playback/snapshot/`, {
      headers: guestAccessToken
        ? { "X-Guest-Access-Token": guestAccessToken }
        : undefined,
    });
    return parseData(successEnvelopeSchema(sharedPlaybackSnapshotSchema), response.data);
  },

  getPlaybackDelivery: async (
    roomCode: string,
    guestAccessToken?: string,
  ) => {
    const response = await client.post(
      `/rooms/${roomCode}/shared-playback/delivery/`,
      undefined,
      {
        headers: guestAccessToken
          ? { "X-Guest-Access-Token": guestAccessToken }
          : undefined,
      },
    );
    return parseData(successEnvelopeSchema(sharedPlaybackDeliverySchema), response.data);
  },
};
