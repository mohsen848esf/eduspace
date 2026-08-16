import { describe, it, expect } from "vitest";
import { calculateOptimalGrid } from "../useGridLayoutCalculator";

describe("calculateOptimalGrid", () => {
  it("calculates optimal 1-tile layout", () => {
    const res = calculateOptimalGrid(1200, 800, 1, 12, 16 / 9);
    expect(res.columns).toBe(1);
    expect(res.rows).toBe(1);
    expect(res.rowDistribution).toEqual([1]);
    expect(res.tileWidth).toBeGreaterThan(0);
    expect(res.tileHeight).toBeGreaterThan(0);
  });

  it("calculates 2-tile layout for wide desktop (side-by-side)", () => {
    const res = calculateOptimalGrid(1200, 800, 2, 12, 16 / 9);
    expect(res.columns).toBe(2);
    expect(res.rows).toBe(1);
    expect(res.rowDistribution).toEqual([2]);
  });

  it("calculates 2-tile layout for mobile portrait (stacked rows)", () => {
    const res = calculateOptimalGrid(360, 740, 2, 12, 16 / 9);
    expect(res.columns).toBe(1);
    expect(res.rows).toBe(2);
    expect(res.rowDistribution).toEqual([1, 1]);
  });

  it("calculates 3-tile layout for wide screen in 1 row (Google Meet Screenshot 2)", () => {
    const res = calculateOptimalGrid(1400, 800, 3, 12, 16 / 9);
    expect(res.columns).toBe(3);
    expect(res.rows).toBe(1);
    expect(res.rowDistribution).toEqual([3]);
  });

  it("calculates 4-tile layout as 2x2 grid (Google Meet Screenshot 3)", () => {
    const res = calculateOptimalGrid(1200, 800, 4, 12, 16 / 9);
    expect(res.columns).toBe(2);
    expect(res.rows).toBe(2);
    expect(res.rowDistribution).toEqual([2, 2]);
  });

  it("calculates 5-tile layout as 2 rows: 2 on top, 3 on bottom (Google Meet Screenshot 4)", () => {
    const res = calculateOptimalGrid(1200, 800, 5, 12, 16 / 9);
    expect(res.columns).toBe(3);
    expect(res.rows).toBe(2);
    expect(res.rowDistribution).toEqual([2, 3]);
  });

  it("calculates 5-tile layout for mobile portrait as 3 rows (2, 2, 1)", () => {
    const res = calculateOptimalGrid(360, 740, 5, 12, 16 / 9);
    expect(res.columns).toBe(2);
    expect(res.rows).toBe(3);
    expect(res.rowDistribution).toEqual([2, 2, 1]);
  });

  it("calculates 6-tile layout as 3x2 grid for landscape", () => {
    const res = calculateOptimalGrid(1200, 800, 6, 12, 16 / 9);
    expect(res.columns).toBe(3);
    expect(res.rows).toBe(2);
    expect(res.rowDistribution).toEqual([3, 3]);
  });

  it("calculates 6-tile layout for mobile portrait as 3 rows of 2 (Google Meet Screenshot 2)", () => {
    const res = calculateOptimalGrid(360, 740, 6, 12, 16 / 9);
    expect(res.columns).toBe(2);
    expect(res.rows).toBe(3);
    expect(res.rowDistribution).toEqual([2, 2, 2]);
  });

  it("gracefully handles zero or negative count", () => {
    const res = calculateOptimalGrid(1200, 800, 0);
    expect(res.rowDistribution).toEqual([]);
  });
});
