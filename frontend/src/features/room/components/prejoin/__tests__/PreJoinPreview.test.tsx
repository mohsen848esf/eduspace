import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreJoinPreview from "../components/PreJoinPreview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/features/auth/store/authStore", () => ({
  useAuthStore: () => ({ user: null }),
}));

vi.mock("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

const originalInnerWidth = window.innerWidth;

describe("PreJoinPreview mobile camera framing", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query.includes("max-width") || query.includes("orientation: portrait"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    vi.unstubAllGlobals();
  });

  it("keeps a portrait card when a mobile WebView reports landscape-like dimensions", () => {
    render(
      <PreJoinPreview
        videoRefCallback={vi.fn()}
        camEnabled
        micEnabled
        onToggleCam={vi.fn()}
        onToggleMic={vi.fn()}
        isMirrored
        onToggleMirror={vi.fn()}
        onOpenSettings={vi.fn()}
        selectedBg="none"
        onChangeBackground={vi.fn()}
        bgLoading={false}
        bgSupported
        isLoadingDevices={false}
        audioLevel={0}
        audioBars={[10, 20, 30]}
      />,
    );

    const preview = screen.getByTestId("prejoin-preview");
    expect(preview.style.aspectRatio).toBe("0.5625 / 1");
    expect(preview).toHaveClass("w-[min(82vw,38dvh)]", "max-w-[22rem]");

    const video = preview.querySelector("video");
    expect(video).not.toBeNull();
    Object.defineProperties(video as HTMLVideoElement, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 960 },
    });
    fireEvent.loadedMetadata(video as HTMLVideoElement);

    expect(preview.style.aspectRatio).toBe("0.5625 / 1");
    expect(video).toHaveStyle({ objectFit: "cover", objectPosition: "center" });
  });
});
