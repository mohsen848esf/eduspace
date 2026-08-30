import { useEffect } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { sharedMediaApi } from "../api/shared-media.api";
import { decodePlaybackInvalidation } from "../lib/realtime";
import { calculateClockOffsetMs } from "../lib/syncMath";
import { useSharedPlaybackStore } from "../store/sharedPlaybackStore";

interface Options {
  room: Room | null;
  roomCode: string;
  guestAccessToken?: string | null;
}

/** LiveKit only wakes reconciliation; REST remains the playback authority. */
export function useSharedPlaybackSync({ room, roomCode, guestAccessToken }: Options) {
  useEffect(() => {
    if (!room || !roomCode) return;
    let disposed = false;
    let running = false;
    let dirty = false;
    let refreshIntervalMs = 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      if (disposed || running) {
        dirty = true;
        return;
      }
      running = true;
      dirty = false;
      const startedAt = Date.now();
      try {
        const snapshot = await sharedMediaApi.getSnapshot(
          roomCode,
          guestAccessToken || undefined,
        );
        const endedAt = Date.now();
        if (disposed) return;
        const store = useSharedPlaybackStore.getState();
        refreshIntervalMs = snapshot.playback?.is_growing
          ? 1_000
          : snapshot.playback?.state === "playing"
            ? 5_000
            : 10_000;
        if (store.applySnapshot(roomCode, snapshot)) {
          store.setClockOffset(
            roomCode,
            calculateClockOffsetMs(snapshot.server_now, startedAt, endedAt),
          );
        }
      } catch {
        // Keep the last authoritative snapshot during transient failures.
      } finally {
        running = false;
        if (!disposed) timer = setTimeout(() => void refresh(), dirty ? 100 : refreshIntervalMs);
      }
    };

    const invalidate = () => {
      if (timer) clearTimeout(timer);
      if (running) {
        dirty = true;
        return;
      }
      timer = setTimeout(() => void refresh(), 75);
    };
    const onData = (payload: Uint8Array) => {
      const message = decodePlaybackInvalidation(payload);
      if (message?.room_code === roomCode) invalidate();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };

    invalidate();
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Connected, invalidate);
    room.on(RoomEvent.Reconnected, invalidate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Connected, invalidate);
      room.off(RoomEvent.Reconnected, invalidate);
      document.removeEventListener("visibilitychange", onVisible);
      if (useSharedPlaybackStore.getState().roomCode === roomCode) {
        useSharedPlaybackStore.getState().reset();
      }
    };
  }, [room, roomCode, guestAccessToken]);
}
