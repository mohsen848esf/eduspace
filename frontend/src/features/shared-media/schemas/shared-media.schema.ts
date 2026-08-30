import { z } from "zod";

export const mediaAssetStatusSchema = z.enum([
  "uploading",
  "uploaded",
  "inspecting",
  "probing",
  "processing",
  "partially_playable",
  "ready",
  "failed",
]);

export const mediaRenditionSchema = z.object({
  label: z.string(),
  status: z.enum(["pending", "processing", "playable", "ready", "failed"]),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  bitrate_bps: z.number().int().nonnegative(),
  published_duration_ms: z.number().int().nonnegative(),
  is_default: z.boolean(),
});

export const mediaAssetSchema = z.object({
  public_token: z.string(),
  title: z.string(),
  original_filename: z.string(),
  status: mediaAssetStatusSchema,
  content_type: z.string(),
  container: z.string(),
  video_codec: z.string(),
  audio_codec: z.string(),
  duration_ms: z.number().int().nonnegative(),
  size_bytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  failure_code: z.string(),
  retention_policy: z.enum(["manual", "scheduled"]),
  expires_at: z.string().nullable(),
  is_deleted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  uploader_name: z.string(),
  can_start_playback: z.boolean(),
  renditions: z.array(mediaRenditionSchema),
});

export const sharedPlaybackSchema = z.object({
  id: z.number().int().positive(),
  room_id: z.number().int().positive(),
  room_code: z.string(),
  asset: mediaAssetSchema,
  controller_identity: z.string(),
  resumed_from_id: z.number().int().positive().nullable(),
  state: z.enum(["idle", "playing", "paused", "buffering", "ended"]),
  sync_policy: z.enum(["continuous", "strict"]),
  buffer_reason: z.enum(["", "frontier", "readiness"]),
  version: z.number().int().positive(),
  anchor_position_ms: z.number().int().nonnegative(),
  expected_position_ms: z.number().int().nonnegative(),
  effective_at: z.string(),
  playback_rate: z.string(),
  published_duration_ms: z.number().int().nonnegative(),
  seekable_until_ms: z.number().int().nonnegative(),
  is_growing: z.boolean(),
  server_now: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  updated_at: z.string(),
});

export const sharedPlaybackSnapshotSchema = z.object({
  playback: sharedPlaybackSchema.nullable(),
  server_now: z.string(),
});

export const sharedPlaybackInvalidationSchema = z.object({
  v: z.literal(1),
  type: z.literal("SHARED_PLAYBACK_INVALIDATED"),
  room_code: z.string(),
  playback_id: z.number().int().positive().nullable(),
  version: z.number().int().nonnegative(),
  emitted_at: z.string(),
});

export const sharedPlaybackHealthSchema = z.object({
  v: z.literal(1),
  type: z.literal("SHARED_PLAYBACK_HEALTH"),
  room_code: z.string().min(1).max(32),
  playback_id: z.number().int().positive(),
  position_ms: z.number().int().nonnegative(),
  expected_position_ms: z.number().int().nonnegative(),
  drift_ms: z.number().int().min(-86_400_000).max(86_400_000),
  buffered_ahead_ms: z.number().int().nonnegative().max(86_400_000),
  status: z.enum(["ready", "buffering", "recovering", "gesture", "error"]),
  quality_label: z.string().max(32),
  emitted_at: z.number().int().positive(),
});

export const mediaAssetListSchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(mediaAssetSchema),
});

export const playbackHistorySchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(sharedPlaybackSchema),
});

export const mediaUploadSessionSchema = z.object({
  public_token: z.string(),
  status: z.enum(["initiated", "uploading", "completed", "aborted", "failed"]),
  expected_size_bytes: z.number().int().positive(),
  uploaded_bytes: z.number().int().nonnegative(),
  part_size_bytes: z.number().int().positive(),
  part_count: z.number().int().positive(),
  content_type: z.string(),
  expires_at: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const signedUploadPartSchema = z.object({
  part_number: z.number().int().positive(),
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
});

export const mediaUploadResumeStateSchema = z.object({
  upload: mediaUploadSessionSchema,
  parts: z.array(z.object({
    part_number: z.number().int().positive(),
    etag: z.string(),
    size_bytes: z.number().int().positive(),
  })),
});

export const progressiveUploadCapabilitySchema = z.object({
  enabled: z.boolean(),
  implementation_stage: z.enum(["disabled", "verified_chunk_upload", "live_ingest_pilot"]),
  play_while_uploading: z.boolean(),
  supported_content_types: z.array(z.string()),
  chunk_size_bytes: z.number().int().positive(),
  prefix_probe_bytes: z.number().int().positive(),
});

export const progressiveMediaUploadSchema = z.object({
  public_token: z.string(),
  status: z.enum([
    "initiated", "uploading", "verifying", "ingesting", "finalizing",
    "completed", "fallback_required", "aborted", "failed",
  ]),
  compatibility: z.enum(["pending", "eligible", "ineligible"]),
  expected_size_bytes: z.number().int().positive(),
  uploaded_bytes: z.number().int().nonnegative(),
  contiguous_uploaded_bytes: z.number().int().nonnegative(),
  contiguous_verified_bytes: z.number().int().nonnegative(),
  chunk_size_bytes: z.number().int().positive(),
  chunk_count: z.number().int().positive(),
  content_type: z.string(),
  fallback_code: z.string(),
  ingest_failure_code: z.string(),
  last_consumed_sequence: z.number().int().nonnegative(),
  ingest_started_at: z.string().nullable(),
  ingest_heartbeat_at: z.string().nullable(),
  ingest_finished_at: z.string().nullable(),
  expires_at: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const progressiveMediaChunkSchema = z.object({
  sequence: z.number().int().positive(),
  expected_size_bytes: z.number().int().positive(),
  status: z.enum(["pending", "uploaded", "verified", "consumed", "failed"]),
  etag: z.string(),
  checksum_sha256: z.string(),
  verified_at: z.string().nullable(),
  updated_at: z.string(),
});

export const progressiveUploadStateSchema = z.object({
  upload: progressiveMediaUploadSchema,
  chunks: z.array(progressiveMediaChunkSchema),
});

export const signedProgressiveChunkSchema = z.object({
  chunk: progressiveMediaChunkSchema,
  upload_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
});

export const sharedPlaybackDeliverySchema = z.object({
  playback_id: z.number().int().positive(),
  asset_public_token: z.string(),
  master_url: z.string().url(),
  expires_in_seconds: z.number().int().positive(),
});

export const successEnvelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    status: z.literal("success"),
    data: dataSchema,
    message: z.string(),
  });

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type SharedPlayback = z.infer<typeof sharedPlaybackSchema>;
export type SharedPlaybackSnapshot = z.infer<typeof sharedPlaybackSnapshotSchema>;
export type SharedPlaybackInvalidation = z.infer<typeof sharedPlaybackInvalidationSchema>;
export type SharedPlaybackHealth = z.infer<typeof sharedPlaybackHealthSchema>;
export type MediaUploadSession = z.infer<typeof mediaUploadSessionSchema>;
export type SharedPlaybackDelivery = z.infer<typeof sharedPlaybackDeliverySchema>;
export type ProgressiveUploadCapability = z.infer<typeof progressiveUploadCapabilitySchema>;
export type ProgressiveMediaUpload = z.infer<typeof progressiveMediaUploadSchema>;
export type ProgressiveMediaChunk = z.infer<typeof progressiveMediaChunkSchema>;
