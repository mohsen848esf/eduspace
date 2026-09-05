import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import toast from "react-hot-toast";
import type { Participant } from "livekit-client";
import type { CanvasElement, WhiteboardEventListener, WhiteboardOperation } from "../types/whiteboard";

export interface WhiteboardState {
  isActive: boolean;
  isMinimized: boolean;
  hostIdentity: string | null;
  isDrawingAllowed: boolean;
}
const TOPIC = "eduspace.whiteboard.v2";
const EMPTY: WhiteboardState = { isActive: false, isMinimized: false, hostIdentity: null, isDrawingAllowed: true };

export function useWhiteboard() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { t } = useTranslation("room");
  const hostIdentity = useRoomStore((s) => s.permissionSnapshot?.host_identity);
  const isHost = useRoomStore((s) => s.isHost);
  const [whiteboard, setWhiteboard] = useState<WhiteboardState>(EMPTY);
  const state = useRef(EMPTY);
  const elements = useRef<Record<string, CanvasElement>>({});
  const listeners = useRef(new Set<WhiteboardEventListener>());
  const incoming = useRef<Promise<unknown>>(Promise.resolve());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const update = useCallback((next: WhiteboardState) => {
    state.current = next;
    setWhiteboard(next);
  }, []);
  const send = useCallback((type: string, payload: unknown, destinations?: string[]) => {
    const operation = queue.current.catch(() => undefined).then(async () => {
      if (room.state !== "connected") throw new Error("Room transport unavailable");
      await room.localParticipant.sendText(JSON.stringify({ type, payload }), { topic: TOPIC, destinationIdentities: destinations });
    });
    queue.current = operation;
    return operation;
  }, [room]);
  const apply = useCallback((type: string, payload: unknown, identity?: string) => {
    if (type === "WHITEBOARD_CLEAR") elements.current = {};
    if (type === "WHITEBOARD_SYNC") elements.current = (payload as { elements?: Record<string, CanvasElement> }).elements || {};
    if (type === "WHITEBOARD_OP") {
      const op = payload as WhiteboardOperation;
      const current = elements.current;
      if (op.type === "CREATE") elements.current = { ...current, [op.element.id]: op.element };
      if (op.type === "UPDATE" && current[op.id]) elements.current = { ...current, [op.id]: { ...current[op.id], ...op.updates } };
      if (op.type === "DELETE") { const next = { ...current }; op.ids.forEach((id) => delete next[id]); elements.current = next; }
      if (op.type === "SYNC_ALL") elements.current = op.elements;
    }
    listeners.current.forEach((fn) => fn(type, payload, identity));
  }, []);
  const sendState = useCallback((identity?: string) => send("WHITEBOARD_STATE", { ...state.current, elements: elements.current }, identity ? [identity] : undefined), [send]);
  const receive = useCallback((type: string, data: Record<string, unknown>, identity: string) => {
    const permissions = useRoomStore.getState().permissionSnapshot;
    const senderIsHost = permissions ? permissions.host_identity === identity : state.current.hostIdentity === identity;
    if (type === "WHITEBOARD_REQUEST_STATE") {
      if (useRoomStore.getState().isHost) void sendState(identity).catch(() => undefined);
      return;
    }
    if (type === "WHITEBOARD_STATE" || type === "WHITEBOARD_LAUNCH" || type === "WHITEBOARD_END") {
      if (!senderIsHost) return;
      if (type === "WHITEBOARD_END" || data.isActive === false) {
        elements.current = {};
        update(EMPTY);
      } else {
        update({ isActive: true, isMinimized: state.current.isActive ? state.current.isMinimized : false, hostIdentity: identity, isDrawingAllowed: data.isDrawingAllowed !== false });
        if (data.elements) apply("WHITEBOARD_SYNC", data, identity);
      }
      return;
    }
    if (type === "WHITEBOARD_RELAY" && state.current.isActive) {
      const inner = data.type as string;
      if (inner === "WHITEBOARD_TOGGLE_DRAWING") {
        if (senderIsHost) update({ ...state.current, isDrawingAllowed: (data.payload as { allowed: boolean }).allowed });
        return;
      }
      if ((inner === "WHITEBOARD_CLEAR" || inner === "WHITEBOARD_SYNC") && !senderIsHost) return;
      if (!state.current.isDrawingAllowed && !senderIsHost) return;
      apply(inner, data.payload, identity);
    }
  }, [apply, sendState, update]);
  const handleDataMessage = useCallback((payload: Uint8Array, participant?: Participant) => {
    if (!participant) return;
    try { const message = JSON.parse(new TextDecoder().decode(payload)); receive(message.type, message.payload || {}, participant.identity); } catch { /* Other room topics. */ }
  }, [receive]);
  useEffect(() => {
    room.registerTextStreamHandler(TOPIC, (reader, participant) => {
      const body = reader.readAll();
      incoming.current = incoming.current.catch(() => undefined).then(async () => {
        try { const message = JSON.parse(await body); receive(message.type, message.payload || {}, participant.identity); }
        catch { toast.error(t("whiteboard.syncFailed")); }
      });
    });
    return () => room.unregisterTextStreamHandler(TOPIC);
  }, [room, receive, t]);
  const requestSyncState = useCallback(async () => {
    if (!isHost && room.state === "connected") await send("WHITEBOARD_REQUEST_STATE", {}).catch(() => undefined);
  }, [isHost, room, send]);
  useEffect(() => {
    void requestSyncState();
    room.on("connected", requestSyncState);
    room.on("reconnected", requestSyncState);
    const pushState = (participant: Participant) => {
      if (isHost) void sendState(participant.identity).catch(() => undefined);
    };
    room.on("participantConnected", pushState);
    return () => { room.off("connected", requestSyncState); room.off("reconnected", requestSyncState); room.off("participantConnected", pushState); };
    // Recover missed messages after transient loss even when no UI is mounted.
  }, [room, isHost, requestSyncState, sendState, hostIdentity]);
  const subscribeWhiteboardEvents = useCallback((fn: WhiteboardEventListener) => {
    listeners.current.add(fn);
    fn("WHITEBOARD_SYNC", { elements: elements.current }, localParticipant.identity);
    return () => { listeners.current.delete(fn); };
  }, [localParticipant.identity]);
  const broadcastWhiteboardEvent = useCallback(async (type: string, payload: unknown, reliable = true) => {
    apply(type, payload, localParticipant.identity);
    try {
      if (reliable) await send("WHITEBOARD_RELAY", { type, payload });
      else if (room.state === "connected") await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "WHITEBOARD_RELAY", payload: { type, payload } })), { reliable: false });
    } catch { if (reliable) toast.error(t("whiteboard.syncFailed"), { id: "whiteboard-sync" }); }
  }, [apply, localParticipant.identity, room, send, t]);
  const launchWhiteboard = useCallback(async () => {
    if (!isHost) return;
    try {
      await send("WHITEBOARD_LAUNCH", { isDrawingAllowed: true });
      elements.current = {};
      update({ ...EMPTY, isActive: true, hostIdentity: localParticipant.identity });
    } catch { toast.error(t("whiteboard.syncFailed")); }
  }, [isHost, send, update, localParticipant.identity, t]);
  const endWhiteboard = useCallback(async () => {
    if (!isHost) return;
    try { await send("WHITEBOARD_END", {}); elements.current = {}; update(EMPTY); }
    catch { toast.error(t("whiteboard.syncFailed")); }
  }, [isHost, send, update, t]);
  const minimizeWhiteboard = useCallback(() => update({ ...state.current, isMinimized: true }), [update]);
  const restoreWhiteboard = useCallback(() => update({ ...state.current, isMinimized: false }), [update]);
  const toggleDrawingPermission = useCallback(async (allowed: boolean) => {
    if (!isHost) return;
    try { await send("WHITEBOARD_RELAY", { type: "WHITEBOARD_TOGGLE_DRAWING", payload: { allowed } }); update({ ...state.current, isDrawingAllowed: allowed }); }
    catch { toast.error(t("whiteboard.syncFailed")); }
  }, [isHost, send, update, t]);
  return { whiteboard, launchWhiteboard, endWhiteboard, minimizeWhiteboard, restoreWhiteboard, toggleDrawingPermission, broadcastWhiteboardEvent, subscribeWhiteboardEvents, handleDataMessage, requestSyncState };
}
