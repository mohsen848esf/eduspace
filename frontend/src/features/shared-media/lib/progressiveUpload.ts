import { sharedMediaApi } from "../api/shared-media.api";
import type { ProgressiveMediaUpload } from "../schemas/shared-media.schema";

interface ProgressiveUploadTransport {
  getProgressiveUploadStatus: typeof sharedMediaApi.getProgressiveUploadStatus;
  signProgressiveChunk: typeof sharedMediaApi.signProgressiveChunk;
  uploadProgressiveChunk: typeof sharedMediaApi.uploadProgressiveChunk;
  commitProgressiveChunk: typeof sharedMediaApi.commitProgressiveChunk;
  completeProgressiveUpload: typeof sharedMediaApi.completeProgressiveUpload;
}

interface ResumeProgressiveUploadOptions {
  assetToken: string;
  uploadToken: string;
  file: File;
  signal?: AbortSignal;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onChunkCommitted?: () => void;
  onState?: (upload: ProgressiveMediaUpload) => void;
  transport?: ProgressiveUploadTransport;
}

const sha256 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const abortIfNeeded = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Upload aborted.", "AbortError");
};

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const onAbort = () => {
    window.clearTimeout(timer);
    reject(new DOMException("Upload aborted.", "AbortError"));
  };
  const timer = window.setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

export const resumeProgressiveUpload = async ({
  assetToken,
  uploadToken,
  file,
  signal,
  onProgress,
  onChunkCommitted,
  onState,
  transport = sharedMediaApi,
}: ResumeProgressiveUploadOptions): Promise<ProgressiveMediaUpload> => {
  let state = await transport.getProgressiveUploadStatus(assetToken, uploadToken);
  if (state.upload.expected_size_bytes !== file.size) {
    throw new Error("Selected file size does not match the progressive upload session.");
  }
  const report = () => {
    onProgress?.(state.upload.uploaded_bytes, state.upload.expected_size_bytes);
    onState?.(state.upload);
  };
  report();

  for (let sequence = 1; sequence <= state.upload.chunk_count; sequence += 1) {
    abortIfNeeded(signal);
    const existing = state.chunks.find((chunk) => chunk.sequence === sequence);
    if (existing?.status === "failed") throw new Error("A progressive upload chunk failed verification.");
    if (["uploaded", "verified", "consumed"].includes(existing?.status || "")) continue;

    const start = (sequence - 1) * state.upload.chunk_size_bytes;
    const end = Math.min(start + state.upload.chunk_size_bytes, file.size);
    const chunk = file.slice(start, end);
    const checksum = await sha256(chunk);
    const signed = await transport.signProgressiveChunk(assetToken, uploadToken, sequence);
    const etag = await transport.uploadProgressiveChunk(signed.upload_url, chunk, signal);
    await transport.commitProgressiveChunk(assetToken, uploadToken, {
      sequence,
      etag,
      checksum_sha256: checksum,
    });
    state = await transport.getProgressiveUploadStatus(assetToken, uploadToken);
    report();
    onChunkCommitted?.();
  }

  const deadline = Date.now() + 10 * 60_000;
  while (state.chunks.filter((chunk) => ["verified", "consumed"].includes(chunk.status)).length
    < state.upload.chunk_count) {
    abortIfNeeded(signal);
    if (Date.now() >= deadline) throw new Error("Timed out while verifying uploaded chunks.");
    if (state.upload.status === "failed" || state.chunks.some((chunk) => chunk.status === "failed")) {
      throw new Error("Progressive upload verification failed.");
    }
    await delay(500, signal);
    state = await transport.getProgressiveUploadStatus(assetToken, uploadToken);
    report();
  }
  return transport.completeProgressiveUpload(assetToken, uploadToken);
};
