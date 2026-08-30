import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { roomApi } from "../api/room.api";
import { applyPermissionSnapshot, PERMISSIONS_INVALIDATED } from "../lib/roomPermissions";
import { useRoomStore } from "../store/roomStore";

/** Data messages are invalidation hints, never grants. Read authority over REST. */
export function useRoomPermissionSync() {
  const room = useRoomContext();
  const roomCode = useRoomStore((s) => s.roomCode);
  const token = useRoomStore((s) => s.token);
  const guestToken = useRoomStore((s) => s.guestAccessToken);
  const isGuest = useRoomStore((s) => s.isGuest);

  useEffect(() => {
    if (!room || !roomCode || (isGuest && !guestToken)) return;
    let disposed = false;
    let running = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const local = room.localParticipant;
    const currentSession = () => !disposed &&
      useRoomStore.getState().roomCode === roomCode && useRoomStore.getState().token === token &&
      useRoomStore.getState().guestAccessToken === guestToken;

    const refresh = async () => {
      if (!currentSession()) return;
      if (running) { dirty = true; return; }
      running = true;
      dirty = false;
      try {
        const snapshot = await roomApi.getPermissions(roomCode, isGuest ? guestToken : null);
        if (!currentSession() || snapshot.room_code !== roomCode || snapshot.identity !== local.identity) return;
        // If an event arrived during this request, fetch again instead of applying stale state.
        if (!dirty) {
          applyPermissionSnapshot(snapshot);
          if (!snapshot.can_share_screen && local.isScreenShareEnabled) {
            void local.setScreenShareEnabled(false).catch(console.error);
          }
          if (!snapshot.can_use_microphone && local.isMicrophoneEnabled) {
            void local.setMicrophoneEnabled(false).catch(console.error);
          }
          if (!snapshot.can_use_camera && local.isCameraEnabled) {
            void local.setCameraEnabled(false).catch(console.error);
          }
        }
      } catch {
        // Preserve the last confirmed state on transient network failure.
      } finally {
        running = false;
        if (currentSession()) timer = setTimeout(() => void refresh(), dirty ? 100 : 15000);
      }
    };
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      if (running) { dirty = true; return; }
      // Coalesce a burst of reliable messages (e.g. approving several requests).
      timer = setTimeout(() => void refresh(), 100);
    };
    const onData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (["PERMISSIONS_CHANGED", "PERMISSION_RESPONSE", "ROOM_SETTINGS_CHANGED", "ROLE_CHANGED"].includes(data.type)) {
          invalidate();
        }
      } catch { /* unrelated packet */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") invalidate(); };
    invalidate();
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Connected, invalidate);
    room.on(RoomEvent.Reconnected, invalidate);
    room.on(RoomEvent.ParticipantConnected, invalidate);
    room.on(RoomEvent.ParticipantDisconnected, invalidate);
    window.addEventListener(PERMISSIONS_INVALIDATED, invalidate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Connected, invalidate);
      room.off(RoomEvent.Reconnected, invalidate);
      room.off(RoomEvent.ParticipantConnected, invalidate);
      room.off(RoomEvent.ParticipantDisconnected, invalidate);
      window.removeEventListener(PERMISSIONS_INVALIDATED, invalidate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [room, roomCode, token, guestToken, isGuest]);
}
