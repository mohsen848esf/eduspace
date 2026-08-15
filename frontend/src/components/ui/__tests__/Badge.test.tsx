import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "../Badge";

describe("Badge component", () => {
  it("renders with text and default variant", () => {
    render(<Badge>Active</Badge>);
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
  });

  it("renders with dot indicator when dot is true", () => {
    const { container } = render(<Badge dot>Live</Badge>);
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("renders live pulsating indicator when variant is live", () => {
    const { container } = render(<Badge variant="live">LIVE NOW</Badge>);
    const liveBadge = container.querySelector(".animate-pulse");
    expect(liveBadge).toBeInTheDocument();
  });
});
