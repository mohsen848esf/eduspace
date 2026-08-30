import { describe, expect, it, vi } from "vitest";
import { resumeProgressiveUpload } from "../progressiveUpload";

describe("resumeProgressiveUpload", () => {
  it("uploads missing chunks in sequence and preserves verified resume state", async () => {
    const chunks = [{
      sequence: 1, expected_size_bytes: 4, status: "verified", etag: "one",
      checksum_sha256: "a".repeat(64), verified_at: "now", updated_at: "now",
    }];
    const upload = {
      public_token: "upload", status: "ingesting", compatibility: "eligible",
      expected_size_bytes: 6, uploaded_bytes: 4, contiguous_uploaded_bytes: 4,
      contiguous_verified_bytes: 4, chunk_size_bytes: 4, chunk_count: 2,
      content_type: "video/mp4", fallback_code: "", ingest_failure_code: "",
      last_consumed_sequence: 0, ingest_started_at: "now", ingest_heartbeat_at: "now",
      ingest_finished_at: null, expires_at: "later", completed_at: null,
      created_at: "now", updated_at: "now",
    } as const;
    const getStatus = vi.fn(async () => ({
      upload: { ...upload, uploaded_bytes: chunks.length === 2 ? 6 : 4 },
      chunks,
    }));
    const transport = {
      getProgressiveUploadStatus: getStatus,
      signProgressiveChunk: vi.fn(async () => ({
        chunk: { sequence: 2 }, upload_url: "https://storage.test/chunk", expires_in_seconds: 900,
      })),
      uploadProgressiveChunk: vi.fn(async () => "etag-two"),
      commitProgressiveChunk: vi.fn(async () => {
        chunks.push({
          sequence: 2, expected_size_bytes: 2, status: "verified", etag: "etag-two",
          checksum_sha256: "b".repeat(64), verified_at: "now", updated_at: "now",
        });
        return chunks[1];
      }),
      completeProgressiveUpload: vi.fn(async () => ({ ...upload, status: "completed" as const })),
    };
    const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6])], "film.mp4", { type: "video/mp4" });
    await resumeProgressiveUpload({ assetToken: "asset", uploadToken: "upload", file, transport });

    expect(transport.signProgressiveChunk).toHaveBeenCalledOnce();
    expect(transport.signProgressiveChunk).toHaveBeenCalledWith("asset", "upload", 2);
    expect(transport.completeProgressiveUpload).toHaveBeenCalledOnce();
  });
});
