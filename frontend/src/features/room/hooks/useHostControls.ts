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
  const { isHost, isCoHost, coHosts, roomCode, addCoHost, removeCoHost } =
    useRoomStore();

  const canModerate = isHost || isCoHost;

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
      if (!canModerate) return;
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
    [canModerate, sendControlMessage, t],
  );

  const kickParticipant = useCallback(
    async (participant: RemoteParticipant) => {
      if (!canModerate) return;
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
    [canModerate, roomCode, t],
  );

  const grantScreenShare = useCallback(
    async (participant: RemoteParticipant) => {
      if (!canModerate) return;
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
    [canModerate, roomCode, t],
  );

  const lowerParticipantHand = useCallback(
    async (participant: RemoteParticipant) => {
      if (!canModerate) return;
      try {
        await client.post(`/rooms/${roomCode}/raise-hand/`, {
          identity: participant.identity,
          raised: false,
        });
        const name = participant.name || participant.identity;
        toast.success(t("host.handLowered", { name }));
      } catch {
        toast.error(t("host.handLowerFailed"));
      }
    },
    [canModerate, roomCode, t],
  );

  const lowerAllHands = useCallback(
    async () => {
      if (!canModerate) return;
      try {
        await client.post(`/rooms/${roomCode}/lower-all-hands/`);
        toast.success(t("host.loweredAllHands"));
      } catch {
        toast.error(t("host.lowerAllHandsFailed"));
      }
    },
    [canModerate, roomCode, t],
  );

  const grantCoHost = useCallback(
    async (username: string) => {
      if (!isHost) return;
      try {
        await client.post(`/rooms/${roomCode}/co-hosts/grant/`, { username });
        addCoHost(username);

        // Broadcast real-time role change to all participants
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "ROLE_CHANGED",
            identity: username,
            role: "co_host",
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });

        toast.success(`${username} به عنوان همیار میزبان انتخاب شد.`);
      } catch {
        toast.error("خطا در انتصاب همیار میزبان.");
      }
    },
    [isHost, roomCode, addCoHost, room],
  );

  const revokeCoHost = useCallback(
    async (username: string) => {
      if (!isHost) return;
      try {
        await client.post(`/rooms/${roomCode}/co-hosts/revoke/`, { username });
        removeCoHost(username);

        // Broadcast real-time role change to all participants
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "ROLE_CHANGED",
            identity: username,
            role: "participant",
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });

        toast.success(`دسترسی همیار میزبان از ${username} گرفته شد.`);
      } catch {
        toast.error("خطا در عزل همیار میزبان.");
      }
    },
    [isHost, roomCode, removeCoHost, room],
  );

  return {
    isHost,
    isCoHost,
    canModerate,
    coHosts,
    muteParticipant,
    kickParticipant,
    grantScreenShare,
    lowerParticipantHand,
    lowerAllHands,
    grantCoHost,
    revokeCoHost,
  };
}
