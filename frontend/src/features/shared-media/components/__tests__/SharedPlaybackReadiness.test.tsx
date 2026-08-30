import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SharedPlaybackReadiness } from "../SharedPlaybackReadiness";

describe("SharedPlaybackReadiness", () => {
  it("closes the readiness popover when clicking outside", () => {
    const { container } = render(
      <SharedPlaybackReadiness entries={[]} totalParticipants={4} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;

    fireEvent.pointerDown(document.body);

    expect(details.open).toBe(false);
  });

  it("keeps the popover open for inside interaction and closes it with Escape", () => {
    const { container } = render(
      <SharedPlaybackReadiness entries={[]} totalParticipants={4} />,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    const summary = container.querySelector("summary") as HTMLElement;
    details.open = true;

    fireEvent.pointerDown(summary);
    expect(details.open).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(summary).toHaveFocus();
  });
});
