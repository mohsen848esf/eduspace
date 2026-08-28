import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresentationDocument } from "../../../schemas/room.schema";
import { PresentationUploadModal } from "../PresentationUploadModal";

const mocks = vi.hoisted(() => ({
  setPresentationsList: vi.fn(),
  retryPresentationConversion: vi.fn(),
  roomState: {
    isHost: true,
    isCoHost: false,
    lockDocumentPresentation: true,
    canUploadPresentation: true,
    isGuest: false,
    guestAccessToken: null as string | null,
  },
  failedDocument: {
    id: 7,
    title: "کلاس آزمایشی",
    file_url: "",
    file_type: "slide",
    source_type: "pptx",
    total_pages: 1,
    current_page: 1,
    uploader_name: "Teacher",
    processing_status: "failed",
    processing_error_code: "CONVERSION_FAILED",
  },
}));

const failedDocument = mocks.failedDocument as PresentationDocument;

vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => null,
}));

vi.mock("../../../store/roomStore", () => ({
  useRoomStore: () => ({
    roomCode: "ROOM01",
    ...mocks.roomState,
    presentationsList: [mocks.failedDocument],
    setPresentationsList: mocks.setPresentationsList,
    setActivePresentation: vi.fn(),
  }),
}));

vi.mock("../../../api/room.api", () => ({
  roomApi: {
    listPresentations: vi.fn().mockResolvedValue({ presentations: [mocks.failedDocument] }),
    retryPresentationConversion: mocks.retryPresentationConversion,
  },
}));

describe("PresentationUploadModal conversion lifecycle", () => {
  beforeEach(() => {
    mocks.failedDocument.processing_status = "failed";
    Object.assign(mocks.roomState, {
      isHost: true,
      isCoHost: false,
      lockDocumentPresentation: true,
      canUploadPresentation: true,
      isGuest: false,
      guestAccessToken: null,
    });
    mocks.setPresentationsList.mockClear();
    mocks.retryPresentationConversion.mockReset();
    mocks.retryPresentationConversion.mockResolvedValue({
      ...failedDocument,
      processing_status: "pending",
      processing_error_code: "",
    });
  });

  it("shows supported static-conversion formats and retries failed documents", async () => {
    render(
      <PresentationUploadModal
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText("PDF، تصویر، PowerPoint، ODP و Word — حداکثر ۵۰ مگابایت"),
    ).toBeInTheDocument();
    expect(screen.getByText("تبدیل سند با خطا مواجه شد.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));

    await waitFor(() => {
      expect(mocks.retryPresentationConversion).toHaveBeenCalledWith("ROOM01", 7, null);
    });
  });

  it("keeps presentation controls hidden for an unsigned guest observer", () => {
    Object.assign(mocks.roomState, {
      isHost: false,
      canUploadPresentation: false,
      isGuest: true,
      guestAccessToken: null,
    });
    mocks.failedDocument.processing_status = "ready";

    render(<PresentationUploadModal isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "شروع ارائه" })).toBeNull();
    expect(screen.queryByRole("button", { name: "تلاش مجدد" })).toBeNull();
    expect(screen.getByText("آماده نمایش")).toBeInTheDocument();
  });
});
