import { sharedMediaApi } from "../api/shared-media.api";
import type { MediaUploadSession } from "../schemas/shared-media.schema";

interface MultipartUploadTransport {
  getUploadStatus: typeof sharedMediaApi.getUploadStatus;
  signUploadPart: typeof sharedMediaApi.signUploadPart;
  uploadPart: typeof sharedMediaApi.uploadPart;
  completeUpload: typeof sharedMediaApi.completeUpload;
}

export interface MultipartUploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  completedParts: number;
  totalParts: number;
}

interface ResumeMultipartUploadOptions {
  assetToken: string;
  uploadToken: string;
  file: File;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: MultipartUploadProgress) => void;
  transport?: MultipartUploadTransport;
}

export const resumeMultipartUpload = async ({
  assetToken,
  uploadToken,
  file,
  concurrency = 3,
  signal,
  onProgress,
  transport = sharedMediaApi,
}: ResumeMultipartUploadOptions): Promise<MediaUploadSession> => {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) {
    throw new Error("Upload concurrency must be between 1 and 6.");
  }
  const state = await transport.getUploadStatus(assetToken, uploadToken);
  const { upload } = state;
  if (file.size !== upload.expected_size_bytes) {
    throw new Error("Selected file size does not match the upload session.");
  }

  const completed = new Map(state.parts.map((part) => [part.part_number, part.etag]));
  let uploadedBytes = state.parts.reduce((sum, part) => sum + part.size_bytes, 0);
  const report = () => onProgress?.({
    uploadedBytes,
    totalBytes: upload.expected_size_bytes,
    completedParts: completed.size,
    totalParts: upload.part_count,
  });
  report();

  const pending = Array.from({ length: upload.part_count }, (_, index) => index + 1)
    .filter((partNumber) => !completed.has(partNumber));
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      if (signal?.aborted) throw new DOMException("Upload aborted.", "AbortError");
      const partNumber = pending[cursor++];
      const start = (partNumber - 1) * upload.part_size_bytes;
      const end = Math.min(start + upload.part_size_bytes, file.size);
      const signed = await transport.signUploadPart(assetToken, uploadToken, partNumber);
      const etag = await transport.uploadPart(
        signed.upload_url,
        file.slice(start, end),
        signal,
      );
      completed.set(partNumber, etag);
      uploadedBytes += end - start;
      report();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()),
  );
  const parts = [...completed.entries()]
    .sort(([left], [right]) => left - right)
    .map(([part_number, etag]) => ({ part_number, etag }));
  return transport.completeUpload(assetToken, uploadToken, parts);
};
