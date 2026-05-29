import { useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoom } from "./useRoom";
import { useBackgroundStore } from "../store/backgroundStore";
import { useRoomStore } from "../store/roomStore";
import { useChatStore } from "../store/chatStore";
import recordingsApi from "../../recordings/api/recordings.api";
import { useActiveRecordingStore } from "../../recordings/store/activeRecordingStore";

interface DisconnectOptions {
  /**
   * If true, stop any in-flight recording before disconnecting. Used by
   * the leave-confirmation modal when the host confirms.
   */
  stopRecordingFirst?: boolean;
}

/**
 * Owns everything that happens when a room session ends:
 *   * stop screen-share / camera processors and tracks
 *   * disconnect LiveKit
 *   * release any leftover MediaStream the OS still indicates as live
 *   * clear cross-room state (chat, background)
 *   * call the backend leave endpoint
 *   * route to the recording editor if the host stopped a recording
 *     during the call
 *
 * The recording-related logic is opt-in via DisconnectOptions and via
 * the activeRecordingStore so a non-host or a host without a recording
 * pays nothing.
 */
export function useRoomDisconnect() {
  const room = useRoomContext();
  const { leaveRoom } = useRoom();
  const { roomCode, isHost } = useRoomStore.getState();

  const disconnect = useCallback(
    async ({ stopRecordingFirst = false }: DisconnectOptions = {}) => {
      const recordingStore = useActiveRecordingStore.getState();

      // 1. If the host wants to stop the recording on the way out, fire
      //    the stop API before tearing down the LiveKit connection. The
      //    egress worker can then finalize cleanly via webhook.
      if (stopRecordingFirst && roomCode && recordingStore.inFlightToken) {
        try {
          await recordingsApi.stop(roomCode);
        } catch {
          // If stop fails (e.g. server hiccup) we still proceed with the
          // leave: LiveKit's egress will end naturally on disconnect.
        }
      }

      try {
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

        // Disconnect LiveKit.
        await room.disconnect(true);

        // Small wait so the browser refreshes the recording indicator.
        await new Promise((r) => setTimeout(r, 500));

        // Release any leftover device handles.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* swallow */
        }
      } catch (err) {
        console.error("Disconnect error:", err);
      } finally {
        if (isHost && roomCode) {
          useChatStore.getState().clearRoom(roomCode);
        }
        useBackgroundStore.getState().setBackground("none");

        // Pull any pending-edit token before we trigger leaveRoom so the
        // store can be reset cleanly afterwards.
        const pendingEditToken = useActiveRecordingStore.getState()
          .pendingEditToken;
        useActiveRecordingStore.getState().reset();

        if (pendingEditToken) {
          // Skip the default `/dashboard` redirect and route the host to
          // the editor for the recording they just stopped.
          await leaveRoom({ redirectTo: `/recordings/${pendingEditToken}/edit` });
        } else {
          leaveRoom();
        }
      }
    },
    [room, leaveRoom, isHost, roomCode],
  );

  return { disconnect };
}
