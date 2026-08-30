import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Participant } from "livekit-client";
import TileView from "../TileView";

vi.mock("@livekit/components-react", () => ({
  VideoTrack: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <video data-testid="tile-video" className={className} style={style} />
  ),
  isTrackReference: () => true,
  useIsSpeaking: () => false,
}));

vi.mock("livekit-client", () => ({
  Track: {
    Source: {
      Camera: "camera",
      ScreenShare: "screen_share",
    },
  },
  RemoteParticipant: class RemoteParticipant {},
}));

const participant = {
  identity: "viewer",
  name: "Viewer",
  metadata: "",
  isCameraEnabled: false,
  isScreenShareEnabled: false,
} as Participant;

function renderTile(kind: "camera" | "screen") {
  const source = kind === "screen" ? "screen_share" : "camera";
  return render(
    <TileView
      tile={{ key: `viewer::${kind}`, kind, participant }}
      tracks={[{ participant, source, publication: { isMuted: false } }] as never}
      localIdentity="local-user"
      pinnedKey={null}
      onTogglePin={vi.fn()}
    />,
  );
}

describe("TileView media presentation", () => {
  it("contains and centers screen share inside a symmetric card inset", () => {
    renderTile("screen");

    const video = screen.getByTestId("tile-video");
    expect(video).toHaveClass("object-contain", "object-center");
    expect(video).not.toHaveClass("object-cover");
    expect(video.parentElement).toHaveClass("items-center", "justify-center", "p-1", "md:p-1.5");
  });

  it("keeps camera video filling its tile", () => {
    renderTile("camera");

    expect(screen.getByTestId("tile-video")).toHaveClass("object-cover", "object-center");
  });

  it("shows only action buttons on hover without dimming or blurring the card", () => {
    const { container } = renderTile("camera");
    fireEvent.mouseEnter(container.firstElementChild as Element);

    const pinButton = screen.getByRole("button", { name: "tile.pin" });
    const actions = pinButton.closest("div.absolute.inset-0");
    expect(actions).toBeInTheDocument();
    expect(actions).toHaveClass("pointer-events-none");
    expect(actions).not.toHaveClass("bg-black/40", "backdrop-blur-[2px]");
  });
});
