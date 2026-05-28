import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { type RemoteParticipant } from "livekit-client";
import { useRoomStore } from "../store/roomStore";
import client from "../../../lib/api/client";
import toast from "react-hot-toast";

const CONTROL_MESSAGES = {
  MUTE_AUDIO: "MUTE_AUDIO",
  MUTE_VIDEO: "MUTE_VIDEO",
} as const;

export function useHostControls() {
  const { t } = useTranslation("room");
  const room = useRoomContext();
  // localParticipant is needed for publishing data; reading from room context.
  useLocalParticipant();
  const { isHost, roomCode } = useRoomStore();

  const sendControlMessage = useCallback(
    async (participant: RemoteParticipant, type: string) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type }));
      await room.localParticipant.publishData(data, {
        reliable: true,
        destinationIdentities: [participant.identity],
      });
    },
    [room],
  );

  const muteParticipant = useCallback(
    async (participant: RemoteParticipant) => {
      if (!isHost) return;
      const isMuted = useRoomStore
        .getState()
        .mutedByHost?.has(participant.identity);

      try {
        await sendControlMessage(
          participant,
          isMuted ? "UNMUTE_AUDIO" : CONTROL_MESSAGES.MUTE_AUDIO,
        );
        useRoomStore.getState().setMutedByHost(participant.identity, !isMuted);
        const name = participant.name || participant.identity;
        toast.success(
          isMuted
            ? t("host.unmuted", { name })
            : t("host.muted", { name }),
        );
      } catch {
        toast.error(t("host.muteFailed"));
      }
    },
    [isHost, sendControlMessage, t],
  );

  const kickParticipant = useCallback(
    async (participant: RemoteParticipant) => {
      if (!isHost) return;
      try {
        await client.post(`/rooms/${roomCode}/kick/`, {
          identity: participant.identity,
        });
        const name = participant.name || participant.identity;
        toast.success(t("host.removed", { name }));
      } catch {
        toast.error(t("host.removeFailed"));
      }
    },
    [isHost, roomCode, t],
  );

  const grantScreenShare = useCallback(
    async (participant: RemoteParticipant) => {
      if (!isHost) return;
      try {
        await client.post(`/rooms/${roomCode}/grant-screen-share/`, {
          identity: participant.identity,
        });
        const name = participant.name || participant.identity;
        toast.success(t("host.screenShareGranted", { name }));
      } catch {
        toast.error(t("host.screenShareFailed"));
      }
    },
    [isHost, roomCode, t],
  );

  return { isHost, muteParticipant, kickParticipant, grantScreenShare };
}
