import { describe, it, expect } from "vitest";
import { getBezierPath, getClosedAreaPath } from "../chart.utils";

describe("Chart calculation utilities", () => {
  it("returns empty string for empty points array", () => {
    expect(getBezierPath([])).toBe("");
    expect(getClosedAreaPath([], 100)).toBe("");
  });

  it("handles single point gracefully", () => {
    expect(getBezierPath([{ x: 10, y: 20 }])).toBe("M 10 20");
  });

  it("computes smooth cubic bezier curve for multiple points", () => {
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 20 },
    ];
    const path = getBezierPath(points);
    expect(path).toContain("M 0 100");
    expect(path).toContain("C");
  });

  it("computes closed area path connecting baseline", () => {
    const points = [
      { x: 10, y: 50 },
      { x: 50, y: 20 },
    ];
    const closed = getClosedAreaPath(points, 100);
    expect(closed).toContain("L 50 100 L 10 100 Z");
  });
});
