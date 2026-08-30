export type ElementType =
  | "pencil"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "sticky"
  | "text"
  | "image"
  | "video";

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;          // Position in infinite canvas space
  y: number;          // Position in infinite canvas space
  width: number;
  height: number;
  rotation?: number;  // 0-360 degrees
  color: string;      // Stroke/Border color
  fillColor?: string; // Fill color (shapes) or Background (sticky notes)
  strokeWidth?: number;
  opacity?: number;   // 0.0 to 1.0
  locked?: boolean;   // Lock modification
  creatorId: string;
  groupId?: string;   // For grouping multiple elements
  timestamp: number;  // For conflict resolution (Last-Write-Wins)
}

export interface PencilElement extends BaseElement {
  type: "pencil";
  points: Point[]; // Points relative to element (x, y)
}

export interface StickyElement extends BaseElement {
  type: "sticky";
  text: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  align: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

export interface ConnectorElement extends BaseElement {
  type: "arrow";
  from: { elementId: string; point: "top" | "bottom" | "left" | "right" | "center" };
  to: { elementId: string; point: "top" | "bottom" | "left" | "right" | "center" };
}

export interface MediaElement extends BaseElement {
  type: "image" | "video";
  url: string; // Base64, Cloud URI, or YouTube/Vimeo URL
}

export type CanvasElement =
  | BaseElement
  | PencilElement
  | StickyElement
  | TextElement
  | ConnectorElement
  | MediaElement;

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export type WhiteboardOperation =
  | { type: "CREATE"; element: CanvasElement }
  | {
      type: "UPDATE";
      id: string;
      updates: Partial<CanvasElement> & { timestamp: number };
    }
  | { type: "DELETE"; ids: string[] }
  | { type: "CURSOR"; x: number; y: number }
  | { type: "SYNC_ALL"; elements: Record<string, CanvasElement> };

export interface WhiteboardSyncPayload {
  hostIdentity?: string;
  isDrawingAllowed?: boolean;
  elements?: Record<string, CanvasElement>;
}

export type WhiteboardEventListener = (
  type: string,
  payload: unknown,
  fromIdentity?: string,
) => void;
