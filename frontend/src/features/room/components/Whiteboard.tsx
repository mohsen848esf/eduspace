import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import toast from "react-hot-toast";

interface WhiteboardProps {
  whiteboard: {
    isActive: boolean;
    hostIdentity: string | null;
    isDrawingAllowed: boolean;
  };
  onEnd: () => void;
  toggleDrawingPermission: (allowed: boolean) => void;
  broadcastWhiteboardEvent: (type: string, payload: any, reliable?: boolean) => void;
  subscribeWhiteboardEvents: (fn: (type: string, payload: any, fromIdentity?: string) => void) => () => void;
  requestSyncState: () => void;
}

interface Path {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

interface CursorState {
  x: number;
  y: number;
  name: string;
  lastUpdated: number;
}

const COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Rose" },
  { value: "#ffffff", label: "White" },
  { value: "#0f172a", label: "Dark" },
];

const WIDTHS = [
  { value: 2, label: "Thin" },
  { value: 5, label: "Medium" },
  { value: 10, label: "Thick" },
];

export default function Whiteboard({
  whiteboard,
  onEnd,
  toggleDrawingPermission,
  broadcastWhiteboardEvent,
  subscribeWhiteboardEvents,
  requestSyncState,
}: WhiteboardProps) {
  const { t } = useTranslation(["room", "common"]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isHost } = useRoomStore();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [color, setColor] = useState("#6366f1");
  const [lineWidth, setLineWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Floating cursors for other participants
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});

  // History of lines drawn (stored locally for late-joiner sync)
  const pathsRef = useRef<Path[]>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Drawing permissions check
  const canDraw = isHost || whiteboard.isDrawingAllowed;

  // Resolve display name by identity
  const getParticipantName = useCallback(
    (identity: string) => {
      if (identity === localParticipant.identity) {
        return localParticipant.name || identity;
      }
      const p = participants.find((part) => part.identity === identity);
      return p?.name || identity;
    },
    [localParticipant, participants],
  );

  // Redraw canvas from path history
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw all recorded paths
    pathsRef.current.forEach((path) => {
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Convert percentages back to local pixels
      const x1 = (path.x1 / 100) * canvas.width;
      const y1 = (path.y1 / 100) * canvas.height;
      const x2 = (path.x2 / 100) * canvas.width;
      const y2 = (path.y2 / 100) * canvas.height;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }, []);

  // Handle canvas sizing and responsiveness
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Set canvas dimensions to match display size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Redraw all lines to scale properly after resize
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Request state sync from host on mount (late joiners)
  useEffect(() => {
    requestSyncState();
  }, [requestSyncState]);

  // Handle network whiteboard events
  useEffect(() => {
    return subscribeWhiteboardEvents((type, payload, fromIdentity) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      switch (type) {
        case "WHITEBOARD_DRAW": {
          const path = payload as Path;
          // Store in local path history
          pathsRef.current.push(path);

          // Draw the received line segment
          ctx.beginPath();
          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          const x1 = (path.x1 / 100) * canvas.width;
          const y1 = (path.y1 / 100) * canvas.height;
          const x2 = (path.x2 / 100) * canvas.width;
          const y2 = (path.y2 / 100) * canvas.height;

          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          break;
        }

        case "WHITEBOARD_CLEAR":
          pathsRef.current = [];
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          break;

        case "WHITEBOARD_CURSOR": {
          if (!fromIdentity || fromIdentity === localParticipant.identity) break;
          const cursor = payload as { x: number; y: number };
          setCursors((prev) => ({
            ...prev,
            [fromIdentity]: {
              x: cursor.x,
              y: cursor.y,
              name: getParticipantName(fromIdentity),
              lastUpdated: Date.now(),
            },
          }));
          break;
        }

        case "WHITEBOARD_REQUEST_STATE":
          // If we are the host, reply with state sync
          if (isHost && fromIdentity) {
            broadcastWhiteboardEvent(
              "WHITEBOARD_SYNC",
              {
                hostIdentity: localParticipant.identity,
                isDrawingAllowed: whiteboard.isDrawingAllowed,
                paths: pathsRef.current,
                identity: localParticipant.identity, // needed to bypass sender check in RELAY
              }
            );
          }
          break;

        case "WHITEBOARD_SYNC": {
          const syncPaths = payload as Path[];
          if (Array.isArray(syncPaths)) {
            pathsRef.current = syncPaths;
            redrawCanvas();
          }
          break;
        }
      }
    });
  }, [
    subscribeWhiteboardEvents,
    localParticipant.identity,
    isHost,
    whiteboard.isDrawingAllowed,
    broadcastWhiteboardEvent,
    getParticipantName,
    redrawCanvas,
  ]);

  // Clean up stale cursors (inactive for >3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([id, cursor]) => {
          if (now - cursor.lastUpdated > 3000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Local drawing actions
  const drawLine = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const activeColor = isEraser ? "#0f172a" : color;

      // Normalize coordinates to percentage (0-100) for responsiveness
      const normX1 = (x1 / canvas.clientWidth) * 100;
      const normY1 = (y1 / canvas.clientHeight) * 100;
      const normX2 = (x2 / canvas.clientWidth) * 100;
      const normY2 = (y2 / canvas.clientHeight) * 100;

      const path: Path = {
        x1: normX1,
        y1: normY1,
        x2: normX2,
        y2: normY2,
        color: activeColor,
        width: lineWidth,
      };

      // Draw locally immediately
      pathsRef.current.push(path);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Broadcast to other participants
      broadcastWhiteboardEvent("WHITEBOARD_DRAW", path, true);
    },
    [color, lineWidth, isEraser, broadcastWhiteboardEvent],
  );

  const handleStartDraw = (x: number, y: number) => {
    if (!canDraw) {
      toast.error("Drawing is locked by host", { id: "wb-locked" });
      return;
    }
    setIsDrawing(true);
    lastPosRef.current = { x, y };
  };

  const handleDrawing = (x: number, y: number) => {
    // Broadcast cursor position (unreliable, throttled implicitly by mousemove speed)
    const canvas = canvasRef.current;
    if (canvas) {
      const normX = (x / canvas.clientWidth) * 100;
      const normY = (y / canvas.clientHeight) * 100;
      broadcastWhiteboardEvent("WHITEBOARD_CURSOR", { x: normX, y: normY }, false);
    }

    if (!isDrawing || !lastPosRef.current) return;
    drawLine(lastPosRef.current.x, lastPosRef.current.y, x, y);
    lastPosRef.current = { x, y };
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    handleStartDraw(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    handleDrawing(e.clientX - rect.left, e.clientY - rect.top);
  };

  // Touch events (for mobile/tablet drawing)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleStartDraw(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  // Clear canvas
  const handleClear = () => {
    if (!isHost) return;
    pathsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    broadcastWhiteboardEvent("WHITEBOARD_CLEAR", {}, true);
    toast.success("Board cleared");
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  };

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col overflow-hidden bg-[#0f172a] select-none touch-none"
    >
      {/* Topbar */}
      <div className="h-12 bg-[#1e293b] border-b border-[#334155] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm" aria-hidden>
            ✏️
          </span>
          <span className="text-sm font-semibold text-white truncate">
            {t("tools.whiteboard")}
          </span>
          {!canDraw && (
            <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              🔒 View Only
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isHost && (
            <>
              <Tooltip
                content={
                  whiteboard.isDrawingAllowed
                    ? "Lock drawing for participants"
                    : "Allow participants to draw"
                }
              >
                <button
                  onClick={() => toggleDrawingPermission(!whiteboard.isDrawingAllowed)}
                  className={cn(
                    "h-8 px-2.5 rounded-lg border-none cursor-pointer flex items-center gap-1.5 text-xs font-semibold transition-colors",
                    whiteboard.isDrawingAllowed
                      ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                  )}
                >
                  {whiteboard.isDrawingAllowed ? "🔓 Collab On" : "🔒 Host Only"}
                </button>
              </Tooltip>

              <button
                onClick={handleClear}
                className="h-8 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border-none cursor-pointer transition-colors flex items-center gap-1"
              >
                🧹 Clear Board
              </button>
            </>
          )}

          <Tooltip content={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-[#334155] text-white hover:bg-[#475569] transition-colors"
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          </Tooltip>

          {isHost && (
            <button
              onClick={onEnd}
              className="flex items-center gap-1 px-2.5 h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg border-none cursor-pointer transition-colors"
            >
              {Icons.leave}
              Close
            </button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-[#0f172a] overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleStopDraw}
          onMouseLeave={handleStopDraw}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleStopDraw}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />

        {/* Cursor overlays */}
        {Object.entries(cursors).map(([id, cursor]) => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const x = (cursor.x / 100) * canvas.clientWidth;
          const y = (cursor.y / 100) * canvas.clientHeight;

          return (
            <div
              key={id}
              className="absolute pointer-events-none transition-all duration-75 flex items-center gap-1"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-2px, -2px)",
                zIndex: 100,
              }}
            >
              {/* Pointer SVG icon */}
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-indigo-400 drop-shadow"
              >
                <path
                  d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"
                  fill="currentColor"
                />
              </svg>
              {/* Floating username label */}
              <span className="text-[9px] font-bold bg-[#1e293b] text-white px-1.5 py-0.5 rounded shadow border border-[#334155] whitespace-nowrap">
                {cursor.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      {canDraw && (
        <div className="h-14 bg-[#1e293b] border-t border-[#334155] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((col) => (
                <button
                  key={col.value}
                  onClick={() => {
                    setColor(col.value);
                    setIsEraser(false);
                  }}
                  aria-label={col.label}
                  className={cn(
                    "w-6 h-6 rounded-full border cursor-pointer transition-transform",
                    color === col.value && !isEraser
                      ? "scale-125 border-white ring-2 ring-indigo-500/40"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: col.value }}
                />
              ))}
              <Tooltip content="Eraser">
                <button
                  onClick={() => setIsEraser(true)}
                  className={cn(
                    "w-7 h-7 rounded-lg border cursor-pointer flex items-center justify-center text-xs transition-colors",
                    isEraser
                      ? "bg-indigo-500/20 border-indigo-400 text-indigo-400"
                      : "bg-[#334155] border-transparent text-gray-300 hover:bg-[#475569]"
                  )}
                >
                  🧽
                </button>
              </Tooltip>
            </div>

            {/* Line Width */}
            <div className="h-6 w-px bg-[#334155]" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Size:
              </span>
              <div className="flex gap-1">
                {WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setLineWidth(w.value)}
                    className={cn(
                      "px-2.5 h-6 rounded text-[10px] font-bold border cursor-pointer transition-colors",
                      lineWidth === w.value
                        ? "bg-indigo-500/20 border-indigo-400 text-indigo-400"
                        : "bg-[#334155] border-transparent text-gray-300 hover:bg-[#475569]"
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-semibold">
            {isEraser ? "Mode: Eraser" : `Brush: ${lineWidth}px`}
          </div>
        </div>
      )}
    </div>
  );
}
