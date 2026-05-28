import { useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoom } from "./useRoom";
import { useBackgroundStore } from "../store/backgroundStore";
import { useRoomStore } from "../store/roomStore";
import { useChatStore } from "../store/chatStore";

export function useRoomDisconnect() {
  const room = useRoomContext();
  const { leaveRoom } = useRoom();
  const { roomCode, isHost } = useRoomStore.getState();

  const disconnect = useCallback(async () => {
    try {
      // ۱. Stop processor و track های local
      const stopPromises: Promise<void>[] = [];

      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.track) {
          stopPromises.push(
            pub.track
              .stopProcessor()
              .catch(() => {})
              .then(() => {
                pub.track?.mediaStreamTrack?.stop();
              }),
          );
        }
      });

      await Promise.all(stopPromises);

      // ۲. Disconnect LiveKit
      await room.disconnect(true);

      // ۳. یه timeout کوچیک بده که مرورگر indicator رو آپدیت کنه
      await new Promise((r) => setTimeout(r, 500));

      // ۴. هر stream باقی‌مانده‌ای رو stop کن
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    } catch (err) {
      console.error("Disconnect error:", err);
    } finally {
      if (isHost && roomCode) {
        useChatStore.getState().clearRoom(roomCode);
      }
      useBackgroundStore.getState().setBackground("none");
      leaveRoom();
    }
  }, [room, leaveRoom]);

  return { disconnect };
}
