import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BottomSheet from "../BottomSheet";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("BottomSheet mobile dismissal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes after a downward touch gesture", () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Panel">
        Content
      </BottomSheet>,
    );

    const handle = screen.getByTestId("bottom-sheet-drag-handle");
    Object.defineProperty(handle.parentElement, "getBoundingClientRect", {
      value: () => ({ height: 600 }),
    });
    const startTouch = { clientX: 20, clientY: 80 };
    const endTouch = { clientX: 20, clientY: 330 };
    fireEvent.touchStart(handle, { touches: [startTouch], targetTouches: [startTouch], changedTouches: [startTouch] });
    fireEvent.touchMove(handle, { touches: [endTouch], targetTouches: [endTouch], changedTouches: [endTouch] });
    fireEvent.touchEnd(handle, { touches: [], targetTouches: [], changedTouches: [endTouch] });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("always exposes a close button", () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="Panel">
        Content
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "actions.close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("positions the header inside the visible mobile viewport", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 640,
        offsetTop: 72,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    render(
      <BottomSheet open onOpenChange={vi.fn()} title="Panel">
        Content
      </BottomSheet>,
    );

    expect(screen.getByRole("dialog")).toHaveStyle({
      height: "640px",
      top: "72px",
    });
    expect(screen.getByText("Panel")).toBeVisible();
    expect(screen.getByRole("button", { name: "actions.close" })).toBeVisible();
  });
});
