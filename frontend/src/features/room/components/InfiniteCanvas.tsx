import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  type CanvasElement,
  type Point,
  type ViewportState,
  type PencilElement,
  type StickyElement,
  type TextElement,
} from "../types/whiteboard";
import { cn } from "../../../lib/utils";

interface InfiniteCanvasProps {
  elements: Record<string, CanvasElement>;
  selectedIds: string[];
  activeTool: string;
  color: string;
  fillColor: string;
  lineWidth: number;
  opacity: number;
  canDraw: boolean;
  snapToGrid: boolean;
  onElementsChange: (elements: Record<string, CanvasElement>) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  broadcastOp: (op: any) => void;
  localParticipantIdentity: string;
}

// Help compute smooth pencil path curves
export function getSvgPathFromPoints(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

export function getEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id = "";
      if (u.hostname.includes("youtu.be")) {
        id = u.pathname.substring(1);
      } else {
        id = u.searchParams.get("v") || "";
      }
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.substring(1);
      return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // fallback
  }
  return url;
}

export default function InfiniteCanvas({
  elements,
  selectedIds,
  activeTool,
  color,
  fillColor,
  lineWidth,
  opacity,
  canDraw,
  snapToGrid,
  onElementsChange,
  onSelectedIdsChange,
  broadcastOp,
  localParticipantIdentity,
}: InfiniteCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transformation state
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingIdRef = useRef<string | null>(null);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });

  // Selection box dragging state
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  
  // Element modification (moving / resizing) state
  const [isDraggingElements, setIsDraggingElements] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null); // e.g., "br"
  const elementDragStartRef = useRef<Point>({ x: 0, y: 0 });
  const initialElementsRef = useRef<Record<string, CanvasElement>>({});

  // Inline text editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const GRID_SIZE = 40;

  // Key listeners for spacebar pan & deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && document.activeElement === document.body) {
        setIsSpacePressed(true);
        e.preventDefault();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0 && !editingId) {
        const nextElements = { ...elements };
        selectedIds.forEach((id) => {
          delete nextElements[id];
        });
        onElementsChange(nextElements);
        broadcastOp({ type: "DELETE", ids: selectedIds });
        onSelectedIdsChange([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedIds, elements, onElementsChange, onSelectedIdsChange, broadcastOp, editingId]);

  // Translate client coordinates (screen space) to infinite canvas space
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return {
        x: (x - viewport.panX) / viewport.zoom,
        y: (y - viewport.panY) / viewport.zoom,
      };
    },
    [viewport],
  );

  // Zooming via scrollwheel or pinch gestures
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Point in canvas space under cursor
    const canvasX = (mouseX - viewport.panX) / viewport.zoom;
    const canvasY = (mouseY - viewport.panY) / viewport.zoom;

    const zoomFactor = 1.08;
    let newZoom = e.deltaY < 0 ? viewport.zoom * zoomFactor : viewport.zoom / zoomFactor;
    newZoom = Math.min(Math.max(newZoom, 0.15), 10); // zoom limit 15% to 1000%

    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;

    setViewport({ panX: newPanX, panY: newPanY, zoom: newZoom });
  };

  // Pointer Down events
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressed || activeTool === "pan") {
      // Pan mode
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (!canDraw) return;
    const pos = screenToCanvas(e.clientX, e.clientY);

    // Clicked outside text editing closes editor
    if (editingId) {
      finishEditingText();
    }

    // Check if clicked selection handles or element
    if (activeTool === "select") {
      const handle = (e.target as SVGElement).getAttribute("data-handle");
      if (handle && selectedIds.length === 1) {
        // Resize handle clicked
        setResizeHandle(handle);
        elementDragStartRef.current = pos;
        initialElementsRef.current = { ...elements };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      // Check if clicked element
      const elementId = (e.target as SVGElement).getAttribute("data-element-id");
      if (elementId) {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (e.shiftKey) {
          // Add to selection
          const nextSelected = selectedIds.includes(elementId)
            ? selectedIds.filter((id) => id !== elementId)
            : [...selectedIds, elementId];
          onSelectedIdsChange(nextSelected);
        } else if (!selectedIds.includes(elementId)) {
          // Select only clicked element
          onSelectedIdsChange([elementId]);
        }
        
        setIsDraggingElements(true);
        elementDragStartRef.current = pos;
        initialElementsRef.current = { ...elements };
        return;
      } else {
        // Clicked empty space: start drag selection box
        onSelectedIdsChange([]);
        setDragStart(pos);
        setDragEnd(pos);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Start drawing shape/sticky/text/pencil
    setIsDrawing(true);
    startPointRef.current = pos;
    const id = "el_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    drawingIdRef.current = id;

    const snapVal = (v: number) => (snapToGrid ? Math.round(v / GRID_SIZE) * GRID_SIZE : v);

    const baseEl: any = {
      id,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      color,
      strokeWidth: lineWidth,
      opacity,
      creatorId: localParticipantIdentity,
      timestamp: Date.now(),
    };

    if (activeTool === "pencil" || activeTool === "highlighter") {
      baseEl.type = "pencil";
      baseEl.points = [{ x: 0, y: 0 }];
      if (activeTool === "highlighter") {
        baseEl.opacity = 0.45;
        baseEl.strokeWidth = lineWidth * 2.5;
      }
    } else if (activeTool === "rectangle") {
      baseEl.type = "rectangle";
      baseEl.fillColor = fillColor;
    } else if (activeTool === "ellipse") {
      baseEl.type = "ellipse";
      baseEl.fillColor = fillColor;
    } else if (activeTool === "diamond") {
      baseEl.type = "diamond";
      baseEl.fillColor = fillColor;
    } else if (activeTool === "line") {
      baseEl.type = "line";
    } else if (activeTool === "arrow") {
      baseEl.type = "arrow";
    } else if (activeTool === "sticky") {
      baseEl.type = "sticky";
      baseEl.x = snapVal(pos.x - 70);
      baseEl.y = snapVal(pos.y - 70);
      baseEl.width = 140;
      baseEl.height = 140;
      baseEl.text = "";
      baseEl.fillColor = fillColor !== "transparent" ? fillColor : "#fef08a"; // Default yellow
    } else if (activeTool === "text") {
      baseEl.type = "text";
      baseEl.x = pos.x;
      baseEl.y = pos.y - 12;
      baseEl.width = 160;
      baseEl.height = 36;
      baseEl.text = "";
      baseEl.fontSize = lineWidth * 3.5 + 10;
      baseEl.align = "left";
    }

    onElementsChange({ ...elements, [id]: baseEl });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Pointer Move events
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Sync remote pointer cursors (throttled locally by mousemove event speed)
    const rawPos = screenToCanvas(e.clientX, e.clientY);
    broadcastOp({ type: "CURSOR", x: rawPos.x, y: rawPos.y });

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const pos = screenToCanvas(e.clientX, e.clientY);
    const snapVal = (v: number) => (snapToGrid ? Math.round(v / GRID_SIZE) * GRID_SIZE : v);

    // Multi-element selection box
    if (dragStart && dragEnd) {
      setDragEnd(pos);
      // Select elements inside box bounds
      const xMin = Math.min(dragStart.x, pos.x);
      const xMax = Math.max(dragStart.x, pos.x);
      const yMin = Math.min(dragStart.y, pos.y);
      const yMax = Math.max(dragStart.y, pos.y);

      const inBoundsIds = Object.values(elements)
        .filter((el) => {
          const elX = el.x;
          const elY = el.y;
          return elX >= xMin && elX <= xMax && elY >= yMin && elY <= yMax;
        })
        .map((el) => el.id);

      onSelectedIdsChange(inBoundsIds);
      return;
    }

    // Element Resizing
    if (resizeHandle && selectedIds.length === 1) {
      const id = selectedIds[0];
      const initial = initialElementsRef.current[id];
      if (!initial) return;

      const dx = pos.x - elementDragStartRef.current.x;
      const dy = pos.y - elementDragStartRef.current.y;

      const nextElements = { ...elements };
      const el = { ...nextElements[id] };

      if (resizeHandle === "br") {
        el.width = snapVal(Math.max(16, initial.width + dx));
        el.height = snapVal(Math.max(16, initial.height + dy));
      }

      el.timestamp = Date.now();
      nextElements[id] = el;
      onElementsChange(nextElements);
      broadcastOp({ type: "UPDATE", id, updates: el });
      return;
    }

    // Element Dragging
    if (isDraggingElements && selectedIds.length > 0) {
      const dx = pos.x - elementDragStartRef.current.x;
      const dy = pos.y - elementDragStartRef.current.y;

      const nextElements = { ...elements };
      selectedIds.forEach((id) => {
        const initial = initialElementsRef.current[id];
        if (!initial) return;
        const el = { ...nextElements[id] };
        el.x = snapVal(initial.x + dx);
        el.y = snapVal(initial.y + dy);
        el.timestamp = Date.now();
        nextElements[id] = el;
        broadcastOp({ type: "UPDATE", id, updates: el });
      });
      onElementsChange(nextElements);
      return;
    }

    // Drawing shapes/pencil
    if (isDrawing && drawingIdRef.current) {
      const id = drawingIdRef.current;
      const nextElements = { ...elements };
      const el = { ...nextElements[id] };
      if (!el) return;

      if (el.type === "pencil") {
        const pencil = el as PencilElement;
        const dx = pos.x - startPointRef.current.x;
        const dy = pos.y - startPointRef.current.y;
        pencil.points = [...pencil.points, { x: dx, y: dy }];
      } else {
        const dx = pos.x - startPointRef.current.x;
        const dy = pos.y - startPointRef.current.y;

        el.width = snapVal(Math.max(4, Math.abs(dx)));
        el.height = snapVal(Math.max(4, Math.abs(dy)));
        el.x = snapVal(dx < 0 ? pos.x : startPointRef.current.x);
        el.y = snapVal(dy < 0 ? pos.y : startPointRef.current.y);
      }

      el.timestamp = Date.now();
      nextElements[id] = el;
      onElementsChange(nextElements);
      broadcastOp({ type: "UPDATE", id, updates: el });
    }
  };

  // Pointer Up events
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (dragStart) {
      setDragStart(null);
      setDragEnd(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (resizeHandle) {
      setResizeHandle(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (isDraggingElements) {
      setIsDraggingElements(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (isDrawing && drawingIdRef.current) {
      const id = drawingIdRef.current;
      const el = elements[id];
      if (el) {
        // Send final creation block reliably
        broadcastOp({ type: "CREATE", element: el });
        if (el.type === "text" || el.type === "sticky") {
          // Select and launch inline editing right away
          onSelectedIdsChange([id]);
          startEditingText(id, el.type === "text" ? (el as TextElement).text : (el as StickyElement).text);
        }
      }
      setIsDrawing(false);
      drawingIdRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // double click selects shape/sticky/text for writing
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const id = (e.target as SVGElement).getAttribute("data-element-id");
    if (id) {
      const el = elements[id];
      if (el && (el.type === "text" || el.type === "sticky")) {
        startEditingText(id, el.type === "text" ? (el as TextElement).text : (el as StickyElement).text);
      }
    }
  };

  const startEditingText = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const finishEditingText = () => {
    if (!editingId) return;
    const nextElements = { ...elements };
    const el = nextElements[editingId];
    if (el) {
      if (el.type === "text") {
        (el as TextElement).text = editingText;
      } else if (el.type === "sticky") {
        (el as StickyElement).text = editingText;
      }
      el.timestamp = Date.now();
      onElementsChange(nextElements);
      broadcastOp({ type: "UPDATE", id: editingId, updates: el });
    }
    setEditingId(null);
    setEditingText("");
  };

  // Render elements in viewport space
  const renderElements = () => {
    return Object.values(elements).map((el) => {
      // Simple bounding frustum culling
      const xLeft = el.x;
      const xRight = el.x + el.width;
      const yTop = el.y;
      const yBottom = el.y + el.height;

      const svgWidth = svgRef.current?.clientWidth || 1000;
      const svgHeight = svgRef.current?.clientHeight || 600;
      const vpLeft = -viewport.panX / viewport.zoom;
      const vpRight = (svgWidth - viewport.panX) / viewport.zoom;
      const vpTop = -viewport.panY / viewport.zoom;
      const vpBottom = (svgHeight - viewport.panY) / viewport.zoom;

      // Culling check (skip pencil elements coordinate calculation since they are complex, cull basic bounds)
      if (
        el.type !== "pencil" &&
        (xRight < vpLeft || xLeft > vpRight || yBottom < vpTop || yTop > vpBottom)
      ) {
        return null;
      }

      const isSelected = selectedIds.includes(el.id);
      const isEditing = editingId === el.id;

      let elementNode = null;

      switch (el.type) {
        case "pencil": {
          const path = el as PencilElement;
          const d = getSvgPathFromPoints(path.points);
          elementNode = (
            <path
              d={d}
              fill="none"
              stroke={path.color}
              strokeWidth={path.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={path.opacity}
              data-element-id={el.id}
            />
          );
          break;
        }

        case "rectangle":
          elementNode = (
            <rect
              x={0}
              y={0}
              width={el.width}
              height={el.height}
              fill={el.fillColor}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              data-element-id={el.id}
              rx={el.fillColor !== "transparent" ? 8 : 0} // Subtle round corners
            />
          );
          break;

        case "ellipse":
          elementNode = (
            <ellipse
              cx={el.width / 2}
              cy={el.height / 2}
              rx={el.width / 2}
              ry={el.height / 2}
              fill={el.fillColor}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              data-element-id={el.id}
            />
          );
          break;

        case "diamond": {
          const w = el.width;
          const h = el.height;
          const points = `${w/2} 0, ${w} ${h/2}, ${w/2} ${h}, 0 ${h/2}`;
          elementNode = (
            <polygon
              points={points}
              fill={el.fillColor}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              data-element-id={el.id}
            />
          );
          break;
        }

        case "line":
          elementNode = (
            <line
              x1={0}
              y1={0}
              x2={el.width}
              y2={el.height}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              data-element-id={el.id}
            />
          );
          break;

        case "arrow":
          elementNode = (
            <line
              x1={0}
              y1={0}
              x2={el.width}
              y2={el.height}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
              opacity={el.opacity}
              markerEnd="url(#arrow)"
              data-element-id={el.id}
            />
          );
          break;

        case "sticky": {
          const sticky = el as StickyElement;
          elementNode = (
            <g data-element-id={el.id}>
              <rect
                x={0}
                y={0}
                width={el.width}
                height={el.height}
                fill={el.fillColor}
                stroke={isSelected ? "transparent" : "rgba(0,0,0,0.1)"}
                strokeWidth={1}
                rx={4}
                className="filter drop-shadow-md"
              />
              <foreignObject
                x={8}
                y={8}
                width={el.width - 16}
                height={el.height - 16}
                style={{ pointerEvents: isEditing ? "auto" : "none" }}
              >
                {isEditing ? (
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={finishEditingText}
                    autoFocus
                    className="w-full h-full bg-transparent border-none outline-none resize-none text-[var(--t0)] font-sans text-xs"
                    style={{ color: "#1e293b" }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-center font-sans text-xs break-words overflow-hidden"
                    style={{ color: "#1e293b", userSelect: "none" }}
                  >
                    {sticky.text || "Double click to write..."}
                  </div>
                )}
              </foreignObject>
            </g>
          );
          break;
        }

        case "text": {
          const txt = el as TextElement;
          elementNode = (
            <g data-element-id={el.id}>
              <foreignObject
                x={0}
                y={0}
                width={el.width}
                height={el.height}
                style={{ pointerEvents: isEditing ? "auto" : "none" }}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={finishEditingText}
                    autoFocus
                    className="w-full h-full bg-transparent border-none outline-none text-white font-sans font-semibold"
                    style={{ fontSize: `${txt.fontSize}px`, color: txt.color }}
                  />
                ) : (
                  <div
                    className="w-full h-full font-sans font-semibold truncate flex items-center"
                    style={{
                      fontSize: `${txt.fontSize}px`,
                      color: txt.color,
                      textAlign: txt.align,
                      userSelect: "none",
                    }}
                  >
                    {txt.text || "Type text..."}
                  </div>
                )}
              </foreignObject>
            </g>
          );
          break;
        }

        case "image":
          elementNode = (
            <image
              href={(el as any).url}
              x={0}
              y={0}
              width={el.width}
              height={el.height}
              preserveAspectRatio="xMidYMid slice"
              data-element-id={el.id}
            />
          );
          break;

        case "video": {
          const embedUrl = getEmbedUrl((el as any).url);
          elementNode = (
            <g data-element-id={el.id}>
              <rect
                x={0}
                y={0}
                width={el.width}
                height={el.height}
                fill="#1e293b"
                stroke={isSelected ? "transparent" : "rgba(0,0,0,0.15)"}
                strokeWidth={1}
                rx={6}
                className="filter drop-shadow-md"
              />
              <foreignObject
                x={0}
                y={0}
                width={el.width}
                height={el.height}
                style={{ pointerEvents: isEditing || isSelected ? "auto" : "none" }}
              >
                <iframe
                  src={embedUrl}
                  title="Embedded Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                />
              </foreignObject>
            </g>
          );
          break;
        }
      }

      return (
        <g
          key={el.id}
          transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation || 0}, ${el.width / 2}, ${el.height / 2})`}
          className="group"
        >
          {elementNode}
          
          {/* Active selection border */}
          {isSelected && !isEditing && el.type !== "pencil" && (
            <rect
              x={-4}
              y={-4}
              width={el.width + 8}
              height={el.height + 8}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="4"
              rx={4}
              className="pointer-events-none"
            />
          )}

          {/* Active selection resize handle (bottom-right) */}
          {isSelected && !isEditing && el.type !== "pencil" && (
            <rect
              x={el.width - 2}
              y={el.height - 2}
              width={8}
              height={8}
              fill="white"
              stroke="#6366f1"
              strokeWidth={2.5}
              rx={1.5}
              data-handle="br"
              className="cursor-se-resize"
            />
          )}
        </g>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-[#0f172a] select-none touch-none overflow-hidden",
        isSpacePressed ? "cursor-grab" : isPanning ? "cursor-grabbing" : "cursor-default"
      )}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          {/* Dynamically scaling grid background */}
          <pattern
            id="dotted-grid"
            width={GRID_SIZE * viewport.zoom}
            height={GRID_SIZE * viewport.zoom}
            patternUnits="userSpaceOnUse"
            x={viewport.panX}
            y={viewport.panY}
          >
            <circle
              cx={1.5 * viewport.zoom}
              cy={1.5 * viewport.zoom}
              r={1 * Math.max(0.5, viewport.zoom)}
              fill="rgba(255, 255, 255, 0.12)"
            />
          </pattern>

          {/* Arrow marker definition */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill={color} />
          </marker>
        </defs>

        {/* Dynamic scaling grid rectangle */}
        <rect width="100%" height="100%" fill="url(#dotted-grid)" />

        {/* Viewport translation group */}
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {renderElements()}

          {/* Drag selection rectangle visual overlay */}
          {dragStart && dragEnd && (
            <rect
              x={Math.min(dragStart.x, dragEnd.x)}
              y={Math.min(dragStart.y, dragEnd.y)}
              width={Math.abs(dragStart.x - dragEnd.x)}
              height={Math.abs(dragStart.y - dragEnd.y)}
              fill="rgba(99, 102, 241, 0.08)"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="3"
              rx={2}
            />
          )}
        </g>
      </svg>

      {/* Floating Zoom Navigation Indicator */}
      <div className="absolute bottom-4 left-4 bg-[#1e293b]/95 backdrop-blur border border-[#334155] rounded-xl flex items-center p-1.5 shadow-xl select-none gap-2 z-50">
        <button
          onClick={() =>
            setViewport((prev) => ({
              ...prev,
              zoom: Math.min(prev.zoom * 1.25, 10),
            }))
          }
          className="w-7 h-7 bg-[#334155] hover:bg-[#475569] text-white border-none rounded-lg font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
        >
          ＋
        </button>
        <span className="text-[11px] font-bold text-gray-300 w-12 text-center">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setViewport((prev) => ({
              ...prev,
              zoom: Math.max(prev.zoom / 1.25, 0.15),
            }))
          }
          className="w-7 h-7 bg-[#334155] hover:bg-[#475569] text-white border-none rounded-lg font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
        >
          －
        </button>
        <div className="w-px h-5 bg-[#334155]" />
        <button
          onClick={() => setViewport({ panX: 0, panY: 0, zoom: 1 })}
          className="px-2 h-7 bg-[#334155] hover:bg-[#475569] text-gray-300 text-[10px] font-bold border-none rounded-lg cursor-pointer transition-colors flex items-center justify-center"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
