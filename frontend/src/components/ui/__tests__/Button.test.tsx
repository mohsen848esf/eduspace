import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "../Button";

describe("Button component", () => {
  it("renders with default props and text content", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("shows spinner and disables when loading", () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("applies fullWidth style when fullWidth is true", () => {
    render(<Button fullWidth>Wide</Button>);
    const btn = screen.getByRole("button", { name: /wide/i });
    expect(btn).toHaveClass("w-full");
  });
});
