import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PresentationStageLayout from "../PresentationStageLayout";

const mocks = vi.hoisted(() => ({ tiles: [] as { key: string; kind: string; participant: { identity: string; name: string } }[] }));
vi.mock("../../../hooks/useCallTiles", () => ({ useCallTiles: () => ({
  tiles: mocks.tiles, tracks: [], localIdentity: "local",
}) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../TileView", () => ({ default: ({ tile }: { tile: { participant: { name: string } } }) => (
  <div data-testid="participant-tile">{tile.participant.name}</div>
) }));
afterEach(cleanup);
beforeEach(() => {
  mocks.tiles = [
    { key: "local::camera", kind: "camera", participant: { identity: "local", name: "Local" } },
    { key: "student::camera", kind: "camera", participant: { identity: "student", name: "Student" } },
    { key: "student::screen", kind: "screen", participant: { identity: "student", name: "Student" } },
  ];
});

describe("presentation participant strip", () => {
  it("shows one camera/avatar tile per participant alongside presentation content", () => {
    render(<PresentationStageLayout><div>Presentation content</div></PresentationStageLayout>);
    expect(screen.getAllByTestId("participant-tile")).toHaveLength(2);
    expect(screen.getByText("Presentation content")).toBeVisible();
    expect(screen.getByRole("complementary")).toBeVisible();
  });

  it("hides and restores the strip locally without remounting content or camera tiles", () => {
    render(<PresentationStageLayout><input aria-label="slide notes" /></PresentationStageLayout>);
    const input = screen.getByRole("textbox");
    const camera = screen.getAllByTestId("participant-tile")[0];
    fireEvent.change(input, { target: { value: "keep this" } });
    fireEvent.click(screen.getByRole("button", { name: /hideParticipants/ }));
    expect(camera).not.toBeVisible();
    expect(screen.getByRole("button", { name: /showParticipants/ })).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("keep this");
    fireEvent.click(screen.getByRole("button", { name: /showParticipants/ }));
    expect(screen.getAllByTestId("participant-tile")[0]).toBe(camera);
    expect(camera).toBeVisible();
  });

  it("caps rendered webcams and opens the member list for overflow", () => {
    mocks.tiles = Array.from({ length: 20 }, (_, i) => ({
      key: `${i}::camera`, kind: "camera", participant: { identity: String(i), name: `User ${i}` },
    }));
    const listener = vi.fn();
    window.addEventListener("eduspace:open-people-tab", listener);
    render(<PresentationStageLayout><div>Slides</div></PresentationStageLayout>);
    expect(screen.getAllByTestId("participant-tile")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "tile.overflowMore" }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("eduspace:open-people-tab", listener);
  });

  it("does not display an empty strip or an irrelevant toggle", () => {
    mocks.tiles = [];
    render(<PresentationStageLayout><div>Slides</div></PresentationStageLayout>);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
