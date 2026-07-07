import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import toast from "react-hot-toast";
import { CanvasElement } from "../types/whiteboard";
import InfiniteCanvas from "./InfiniteCanvas";

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

const FILL_COLORS = [
  { value: "transparent", label: "None" },
  { value: "rgba(99, 102, 241, 0.12)", label: "Indigo Light" },
  { value: "rgba(16, 185, 129, 0.12)", label: "Emerald Light" },
  { value: "rgba(245, 158, 11, 0.12)", label: "Amber Light" },
  { value: "rgba(239, 68, 68, 0.12)", label: "Rose Light" },
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
  const { isHost } = useRoomStore();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  // Floating toolbar state
  const [activeTool, setActiveTool] = useState<string>("pencil");
  const [color, setColor] = useState("#6366f1");
  const [fillColor, setFillColor] = useState("transparent");
  const [lineWidth, setLineWidth] = useState(5);
  const [opacity] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Whiteboard Canvas State
  const [elements, setElements] = useState<Record<string, CanvasElement>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);

  // Undo / Redo history stacks
  const historyRef = useRef<Record<string, CanvasElement>[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Sync elementsRef to read latest in listeners
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const canDraw = isHost || whiteboard.isDrawingAllowed;

  // Resolve user display names
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

  // Push elements snapshot to history stack
  const saveToHistory = useCallback((nextElements: Record<string, CanvasElement>) => {
    // Truncate future stack if we were in the middle of undoing
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    history.push(nextElements);

    // Limit stack size to 50
    if (history.length > 50) {
      history.shift();
    }

    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current] || {};
      setElements(prevState);
      broadcastWhiteboardEvent("WHITEBOARD_OP", { type: "SYNC_ALL", elements: prevState }, true);
    }
  }, [broadcastWhiteboardEvent]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      setElements(nextState);
      broadcastWhiteboardEvent("WHITEBOARD_OP", { type: "SYNC_ALL", elements: nextState }, true);
    }
  }, [broadcastWhiteboardEvent]);

  // Handle incoming collaboration events
  useEffect(() => {
    return subscribeWhiteboardEvents((type, payload, fromIdentity) => {
      switch (type) {
        case "WHITEBOARD_OP": {
          const op = payload as any;
          if (fromIdentity === localParticipant.identity) break;

          switch (op.type) {
            case "CREATE": {
              const el = op.element as CanvasElement;
              setElements((prev) => {
                const existing = prev[el.id];
                if (existing && existing.timestamp >= el.timestamp) return prev;
                return { ...prev, [el.id]: el };
              });
              break;
            }
            case "UPDATE": {
              const { id, updates } = op;
              setElements((prev) => {
                const el = prev[id];
                if (!el || el.timestamp >= updates.timestamp) return prev;
                return { ...prev, [id]: { ...el, ...updates } };
              });
              break;
            }
            case "DELETE": {
              const { ids } = op;
              setElements((prev) => {
                const next = { ...prev };
                ids.forEach((id: string) => delete next[id]);
                return next;
              });
              setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
              break;
            }
            case "CURSOR": {
              if (!fromIdentity) break;
              setCursors((prev) => ({
                ...prev,
                [fromIdentity]: {
                  x: op.x,
                  y: op.y,
                  name: getParticipantName(fromIdentity),
                  lastUpdated: Date.now(),
                },
              }));
              break;
            }
            case "SYNC_ALL": {
              setElements(op.elements);
              break;
            }
          }
          break;
        }

        case "WHITEBOARD_CLEAR":
          setElements({});
          setSelectedIds([]);
          break;

        case "WHITEBOARD_REQUEST_STATE":
          // If we are host, respond to joiner request with current elements dictionary
          if (isHost && fromIdentity) {
            broadcastWhiteboardEvent("WHITEBOARD_SYNC", {
              hostIdentity: localParticipant.identity,
              isDrawingAllowed: whiteboard.isDrawingAllowed,
              elements: elementsRef.current,
            });
          }
          break;

        case "WHITEBOARD_SYNC": {
          const syncData = payload as any;
          if (syncData && syncData.elements) {
            setElements(syncData.elements);
            // Seed initial history
            historyRef.current = [syncData.elements];
            historyIndexRef.current = 0;
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
  ]);

  // Clean stale cursor pointers (> 3s inactivity)
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

  // Request state sync from host on startup (late joiners)
  useEffect(() => {
    requestSyncState();
  }, [requestSyncState]);

  // Element changes trigger callback
  const handleElementsChange = (nextElements: Record<string, CanvasElement>) => {
    setElements(nextElements);
    saveToHistory(nextElements);
  };

  // Dispatch operations to participants
  const handleBroadcastOp = (op: any) => {
    const reliable = op.type !== "CURSOR";
    broadcastWhiteboardEvent("WHITEBOARD_OP", op, reliable);
  };

  // Embed video helper
  const handleAddVideo = () => {
    const url = prompt("Enter YouTube or Vimeo video URL:");
    if (!url) return;

    const id = "el_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    const newEl: CanvasElement = {
      id,
      type: "video",
      x: 100,
      y: 100,
      width: 320,
      height: 180,
      color: "#6366f1",
      creatorId: localParticipant.identity,
      timestamp: Date.now(),
      url: url,
    } as any;

    const nextElements = { ...elements, [id]: newEl };
    handleElementsChange(nextElements);
    handleBroadcastOp({ type: "CREATE", element: newEl });
  };

  // Upload image helper
  const handleAddImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const id = "el_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        const newEl: CanvasElement = {
          id,
          type: "image",
          x: 150,
          y: 150,
          width: 250,
          height: 250,
          color: "#6366f1",
          creatorId: localParticipant.identity,
          timestamp: Date.now(),
          url: reader.result as string,
        } as any;

        const nextElements = { ...elements, [id]: newEl };
        handleElementsChange(nextElements);
        handleBroadcastOp({ type: "CREATE", element: newEl });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Clear canvas board
  const handleClear = () => {
    if (!isHost) return;
    setElements({});
    setSelectedIds([]);
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
      className="flex flex-1 flex-col overflow-hidden bg-[#0f172a] select-none touch-none relative"
    >
      {/* Topbar */}
      <div className="h-12 bg-[#1e293b] border-b border-[#334155] flex items-center justify-between px-3 flex-shrink-0 z-10">
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

      {/* Infinite Drawing Canvas Viewport */}
      <div className="flex-1 relative bg-[#0f172a] overflow-hidden">
        <InfiniteCanvas
          elements={elements}
          selectedIds={selectedIds}
          activeTool={activeTool}
          color={color}
          fillColor={fillColor}
          lineWidth={lineWidth}
          opacity={opacity}
          canDraw={canDraw}
          snapToGrid={snapToGrid}
          onElementsChange={handleElementsChange}
          onSelectedIdsChange={setSelectedIds}
          broadcastOp={handleBroadcastOp}
          localParticipantIdentity={localParticipant.identity}
        />

        {/* Remote Cursors Floating Overlay */}
        {Object.entries(cursors).map(([id, cursor]) => (
          <div
            key={id}
            className="absolute pointer-events-none transition-all duration-75 flex items-center gap-1 z-40"
            style={{
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
              transform: "translate(-2px, -2px)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-indigo-400 drop-shadow"
            >
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="currentColor" />
            </svg>
            <span className="text-[9px] font-bold bg-[#1e293b] text-white px-1.5 py-0.5 rounded shadow border border-[#334155] whitespace-nowrap">
              {cursor.name}
            </span>
          </div>
        ))}

        {/* Floating Left Toolbar (Miro-like) */}
        {canDraw && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-[#1e293b]/95 backdrop-blur border border-[#334155] rounded-xl p-2 shadow-2xl z-50">
            {[
              { id: "select", icon: "↖", label: "Select (V)" },
              { id: "pencil", icon: "✏️", label: "Brush" },
              { id: "highlighter", icon: "🖌️", label: "Highlighter" },
              { id: "text", icon: "🇦", label: "Text Block" },
              { id: "sticky", icon: "🗒️", label: "Sticky Note" },
              { id: "rectangle", icon: "▭", label: "Rectangle" },
              { id: "ellipse", icon: "◯", label: "Ellipse" },
              { id: "diamond", icon: "♢", label: "Diamond" },
              { id: "line", icon: "―", label: "Line" },
              { id: "arrow", icon: "➔", label: "Arrow Connector" },
            ].map((tool) => (
              <Tooltip key={tool.id} content={tool.label} side="right">
                <button
                  onClick={() => {
                    setActiveTool(tool.id);
                    setSelectedIds([]);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold cursor-pointer transition-colors border-none",
                    activeTool === tool.id
                      ? "bg-indigo-500 text-white"
                      : "bg-transparent text-gray-300 hover:bg-[#334155]"
                  )}
                >
                  {tool.icon}
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Floating Bottom Properties Bar */}
        {canDraw && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1e293b]/95 backdrop-blur border border-[#334155] rounded-xl px-3 py-2 shadow-2xl z-50">
            {/* Color choices */}
            <div className="flex items-center gap-1">
              {COLORS.map((col) => (
                <button
                  key={col.value}
                  onClick={() => setColor(col.value)}
                  className={cn(
                    "w-5 h-5 rounded-full border cursor-pointer transition-transform",
                    color === col.value
                      ? "scale-125 border-white ring-2 ring-indigo-500/40"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: col.value }}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-[#334155]" />

            {/* Fill styles choice */}
            <div className="flex items-center gap-1">
              {FILL_COLORS.map((col) => (
                <button
                  key={col.value}
                  onClick={() => setFillColor(col.value)}
                  className={cn(
                    "w-5 h-5 rounded border cursor-pointer transition-transform flex items-center justify-center text-[10px] text-white",
                    fillColor === col.value
                      ? "scale-125 border-white ring-2 ring-indigo-500/40"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{
                    backgroundColor: col.value === "transparent" ? "#0f172a" : col.value,
                    border: col.value === "transparent" ? "1px dashed rgba(255,255,255,0.4)" : "none",
                  }}
                >
                  {col.value === "transparent" && "Ø"}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[#334155]" />

            {/* Brush sizes */}
            <div className="flex gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setLineWidth(w.value)}
                  className={cn(
                    "px-2 h-6 rounded text-[9px] font-bold border cursor-pointer transition-colors",
                    lineWidth === w.value
                      ? "bg-indigo-500/20 border-indigo-400 text-indigo-400"
                      : "bg-[#334155] border-transparent text-gray-300 hover:bg-[#475569]"
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[#334155]" />

            {/* Embed Image and Video options */}
            <Tooltip content="Upload Image">
              <button
                onClick={handleAddImage}
                className="h-6 w-6 rounded bg-[#334155] hover:bg-[#475569] text-white text-xs border-none cursor-pointer flex items-center justify-center"
              >
                🖼️
              </button>
            </Tooltip>

            <Tooltip content="Embed YouTube / Vimeo">
              <button
                onClick={handleAddVideo}
                className="h-6 w-6 rounded bg-[#334155] hover:bg-[#475569] text-white text-xs border-none cursor-pointer flex items-center justify-center"
              >
                📺
              </button>
            </Tooltip>

            <div className="w-px h-5 bg-[#334155]" />

            {/* Grid Snapping Toggle */}
            <Tooltip content={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}>
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={cn(
                  "w-6 h-6 rounded text-xs border-none cursor-pointer flex items-center justify-center transition-colors",
                  snapToGrid ? "bg-indigo-500 text-white" : "bg-[#334155] text-gray-300 hover:bg-[#475569]"
                )}
              >
                🧲
              </button>
            </Tooltip>

            {/* Undo / Redo */}
            <Tooltip content="Undo">
              <button
                onClick={handleUndo}
                className="w-6 h-6 rounded text-xs border-none bg-[#334155] text-gray-300 hover:bg-[#475569] cursor-pointer flex items-center justify-center"
              >
                ↶
              </button>
            </Tooltip>

            <Tooltip content="Redo">
              <button
                onClick={handleRedo}
                className="w-6 h-6 rounded text-xs border-none bg-[#334155] text-gray-300 hover:bg-[#475569] cursor-pointer flex items-center justify-center"
              >
                ↷
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
