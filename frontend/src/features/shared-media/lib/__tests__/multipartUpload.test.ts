import { describe, expect, it, vi } from "vitest";
import { resumeMultipartUpload } from "../multipartUpload";

describe("resumeMultipartUpload", () => {
  it("skips provider parts recovered after refresh and completes in order", async () => {
    const completeUpload = vi.fn().mockResolvedValue({ status: "completed" });
    const progress = vi.fn();
    const transport = {
      getUploadStatus: vi.fn().mockResolvedValue({
        upload: {
          expected_size_bytes: 10,
          part_size_bytes: 4,
          part_count: 3,
        },
        parts: [{ part_number: 1, etag: "etag-1", size_bytes: 4 }],
      }),
      signUploadPart: vi.fn(async (_asset: string, _upload: string, part: number) => ({
        part_number: part,
        upload_url: `https://storage.test/${part}`,
        expires_in_seconds: 900,
      })),
      uploadPart: vi.fn(async (url: string) => `etag-${url.at(-1)}`),
      completeUpload,
    };
    const file = new File([new Uint8Array(10)], "film.mp4", { type: "video/mp4" });

    await resumeMultipartUpload({
      assetToken: "asset",
      uploadToken: "upload",
      file,
      concurrency: 2,
      onProgress: progress,
      transport,
    });

    expect(transport.signUploadPart).toHaveBeenCalledTimes(2);
    expect(completeUpload).toHaveBeenCalledWith("asset", "upload", [
      { part_number: 1, etag: "etag-1" },
      { part_number: 2, etag: "etag-2" },
      { part_number: 3, etag: "etag-3" },
    ]);
    expect(progress).toHaveBeenLastCalledWith({
      uploadedBytes: 10,
      totalBytes: 10,
      completedParts: 3,
      totalParts: 3,
    });
  });

  it("rejects a different file before signing new parts", async () => {
    const transport = {
      getUploadStatus: vi.fn().mockResolvedValue({
        upload: { expected_size_bytes: 11, part_size_bytes: 4, part_count: 3 },
        parts: [],
      }),
      signUploadPart: vi.fn(),
      uploadPart: vi.fn(),
      completeUpload: vi.fn(),
    };
    const file = new File([new Uint8Array(10)], "film.mp4");
    await expect(resumeMultipartUpload({
      assetToken: "asset",
      uploadToken: "upload",
      file,
      transport,
    })).rejects.toThrow("does not match");
    expect(transport.signUploadPart).not.toHaveBeenCalled();
  });
});
