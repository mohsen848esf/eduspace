import { useState, useEffect, useRef, useMemo } from "react";

export interface GridLayoutResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  dimensions: { width: number; height: number };
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  rowDistribution: number[]; // e.g. [2, 3] for 5 items (2 on top row, 3 on bottom row)
}

export function calculateOptimalGrid(
  containerWidth: number,
  containerHeight: number,
  count: number,
  gap = 12,
  targetAspectRatio = 16 / 9
): {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  rowDistribution: number[];
} {
  if (count <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return {
      columns: 1,
      rows: 1,
      tileWidth: 0,
      tileHeight: 0,
      rowDistribution: [],
    };
  }

  if (count === 1) {
    const maxWidth = containerWidth - gap * 2;
    const maxHeight = containerHeight - gap * 2;
    let w = maxWidth;
    let h = w / targetAspectRatio;
    if (h > maxHeight) {
      h = maxHeight;
      w = h * targetAspectRatio;
    }
    return {
      columns: 1,
      rows: 1,
      tileWidth: Math.floor(w),
      tileHeight: Math.floor(h),
      rowDistribution: [1],
    };
  }

  // Determine aspect ratio orientation
  const isLandscape = containerWidth >= containerHeight;

  // Specific special cases for Google Meet perfection
  if (count === 2) {
    if (isLandscape && containerWidth > 700) {
      // 1 row of 2 side-by-side
      const availW = containerWidth - gap;
      const availH = containerHeight;
      let w = availW / 2;
      let h = w / targetAspectRatio;
      if (h > availH) {
        h = availH;
        w = h * targetAspectRatio;
      }
      return {
        columns: 2,
        rows: 1,
        tileWidth: Math.floor(w),
        tileHeight: Math.floor(h),
        rowDistribution: [2],
      };
    } else {
      // 2 stacked rows (for mobile portrait)
      const availW = containerWidth;
      const availH = containerHeight - gap;
      let h = availH / 2;
      let w = h * targetAspectRatio;
      if (w > availW) {
        w = availW;
        h = w / targetAspectRatio;
      }
      return {
        columns: 1,
        rows: 2,
        tileWidth: Math.floor(w),
        tileHeight: Math.floor(h),
        rowDistribution: [1, 1],
      };
    }
  }

  if (count === 3) {
    if (containerWidth > 900 && containerWidth / containerHeight > 1.6) {
      // Wide desktop: 1 row with 3 tiles (Google Meet Screenshot 2)
      const availW = containerWidth - gap * 2;
      const availH = containerHeight;
      let w = availW / 3;
      let h = w / targetAspectRatio;
      if (h > availH) {
        h = availH;
        w = h * targetAspectRatio;
      }
      return {
        columns: 3,
        rows: 1,
        tileWidth: Math.floor(w),
        tileHeight: Math.floor(h),
        rowDistribution: [3],
      };
    } else {
      // 2 rows: 2 on top, 1 centered on bottom
      const availH = containerHeight - gap;
      let h = availH / 2;
      let w = h * targetAspectRatio;
      if (w * 2 + gap > containerWidth) {
        w = (containerWidth - gap) / 2;
        h = w / targetAspectRatio;
      }
      return {
        columns: 2,
        rows: 2,
        tileWidth: Math.floor(w),
        tileHeight: Math.floor(h),
        rowDistribution: [2, 1],
      };
    }
  }

  if (count === 4) {
    // 2x2 grid (Google Meet Screenshot 3)
    const availW = containerWidth - gap;
    const availH = containerHeight - gap;
    let w = availW / 2;
    let h = w / targetAspectRatio;
    if (h * 2 + gap > containerHeight) {
      h = availH / 2;
      w = h * targetAspectRatio;
    }
    return {
      columns: 2,
      rows: 2,
      tileWidth: Math.floor(w),
      tileHeight: Math.floor(h),
      rowDistribution: [2, 2],
    };
  }

  if (count === 5) {
    // 2 rows: 2 on top row, 3 on bottom row (Google Meet Screenshot 4)
    const availH = containerHeight - gap;
    let h = availH / 2;
    let w = h * targetAspectRatio;
    if (w * 3 + gap * 2 > containerWidth) {
      w = (containerWidth - gap * 2) / 3;
      h = w / targetAspectRatio;
    }
    return {
      columns: 3,
      rows: 2,
      tileWidth: Math.floor(w),
      tileHeight: Math.floor(h),
      rowDistribution: [2, 3],
    };
  }

  if (count === 6) {
    // 3x2 grid
    const availW = containerWidth - gap * 2;
    const availH = containerHeight - gap;
    let w = availW / 3;
    let h = w / targetAspectRatio;
    if (h * 2 + gap > containerHeight) {
      h = availH / 2;
      w = h * targetAspectRatio;
    }
    return {
      columns: 3,
      rows: 2,
      tileWidth: Math.floor(w),
      tileHeight: Math.floor(h),
      rowDistribution: [3, 3],
    };
  }

  // General Bin-Packing Optimization for N >= 7
  let bestColumns = 1;
  let bestRows = count;
  let maxArea = 0;
  let bestTileW = 0;
  let bestTileH = 0;

  for (let cols = 1; cols <= Math.min(count, 8); cols++) {
    const rows = Math.ceil(count / cols);
    const availW = containerWidth - (cols - 1) * gap;
    const availH = containerHeight - (rows - 1) * gap;

    if (availW <= 0 || availH <= 0) continue;

    let w = availW / cols;
    let h = w / targetAspectRatio;

    if (h * rows > availH) {
      h = availH / rows;
      w = h * targetAspectRatio;
    }

    const area = w * h;
    if (area > maxArea) {
      maxArea = area;
      bestColumns = cols;
      bestRows = rows;
      bestTileW = w;
      bestTileH = h;
    }
  }

  // Distribute tiles across rows
  const rowDistribution: number[] = [];
  const basePerRow = Math.floor(count / bestRows);
  const remainder = count % bestRows;

  for (let r = 0; r < bestRows; r++) {
    rowDistribution.push(basePerRow + (r >= bestRows - remainder ? 1 : 0));
  }

  return {
    columns: bestColumns,
    rows: bestRows,
    tileWidth: Math.floor(bestTileW),
    tileHeight: Math.floor(bestTileH),
    rowDistribution,
  };
}

export function useGridLayoutCalculator(
  count: number,
  gap = 12,
  targetAspectRatio = 16 / 9
): GridLayoutResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const grid = useMemo(() => {
    return calculateOptimalGrid(
      dimensions.width,
      dimensions.height,
      count,
      gap,
      targetAspectRatio
    );
  }, [dimensions.width, dimensions.height, count, gap, targetAspectRatio]);

  return {
    containerRef,
    dimensions,
    ...grid,
  };
}
