import { roomApi } from "../api/room.api";
import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";

/**
 * Persistent hook that runs at the room shell level to ensure
 * all participants immediately receive presentation broadcast events
 * (start, page change, stop) over LiveKit data channel, and auto-open
 * the presentation stage for everyone in the call.
 */
export function usePresentationSync() {
  const room = useRoomContext();
  const {
    setActivePresentation,
    setIsPresentationMinimized,
    setPresentationCurrentPage,
  } = useRoomStore();

  useEffect(() => {
    if (!room) return;

    let disposed = false;
    let loading = false;
    const syncFromServer = async () => {
      const code = useRoomStore.getState().roomCode;
      if (!code || loading) return;
      loading = true;
      const beforeRequest = useRoomStore.getState().activePresentation;
      try {
        const { presentations } = await roomApi.listPresentations(code);
        if (disposed || useRoomStore.getState().activePresentation !== beforeRequest) return;
        const active = presentations.find((doc) => doc.is_active_on_stage) || null;
        const previous = useRoomStore.getState().activePresentation;
        if (previous?.id !== active?.id) { setActivePresentation(active); setIsPresentationMinimized(false); }
        if (active) setPresentationCurrentPage(active.current_page);
      } catch { /* Retry on next tick or reconnect. */ }
      finally { loading = false; }
    };
    void syncFromServer();
    const interval = window.setInterval(() => void syncFromServer(), 4000);
    room.on("reconnected", syncFromServer);
    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (["PRESENTATION_START", "PRESENTATION_PAGE_CHANGE", "PRESENTATION_STOP"].includes(data.type)) void syncFromServer();
      } catch { /* Other room messages. */ }
    };

    room.on("dataReceived", handleData);
    return () => {
      disposed = true;
      clearInterval(interval);
      room.off("reconnected", syncFromServer);
      room.off("dataReceived", handleData);
    };
  }, [
    room,
    setActivePresentation,
    setIsPresentationMinimized,
    setPresentationCurrentPage,
  ]);
}
