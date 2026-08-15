/**
 * SVG Chart calculation utilities for dashboard visualizations.
 */

export interface Point {
  x: number;
  y: number;
}

export const getBezierPath = (points: Point[]): string => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return path;
};

export const getClosedAreaPath = (
  points: Point[],
  baselineY: number,
  startX?: number
): string => {
  if (points.length === 0) return "";
  const curve = getBezierPath(points);
  const start = startX !== undefined ? startX : points[0].x;
  const lastX = points[points.length - 1].x;
  return `${curve} L ${lastX} ${baselineY} L ${start} ${baselineY} Z`;
};
