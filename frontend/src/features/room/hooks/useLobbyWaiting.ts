import { useEffect, useRef, useState } from "react";
import { roomApi } from "../api/room.api";

export type LobbyWaitingStatus =
  | "pending"
  | "admitted"
  | "denied"
  | "expired"
  | "room_ended"
  | "network_error";

interface UseLobbyWaitingOptions {
  roomCode: string;
  requestId: number | null;
  guestAccessToken?: string | null;
  enabled: boolean;
  onAdmitted: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    name: string;
    isGuest?: boolean;
    guestIdentity?: string;
    guestAccessToken?: string;
    lockDocumentPresentation?: boolean;
    canUploadPresentation?: boolean;
  }) => void;
}

export function useLobbyWaiting({
  roomCode,
  requestId,
  guestAccessToken,
  enabled,
  onAdmitted,
}: UseLobbyWaitingOptions) {
  const [status, setStatus] = useState<LobbyWaitingStatus>("pending");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const consecutiveErrorsRef = useRef(0);
  const onAdmittedRef = useRef(onAdmitted);

  useEffect(() => {
    onAdmittedRef.current = onAdmitted;
  }, [onAdmitted]);

  // Elapsed timer
  useEffect(() => {
    if (!enabled || !requestId || status !== "pending") return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled, requestId, status]);

  // Polling loop
  useEffect(() => {
    if (!enabled || !requestId || !roomCode) return;

    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await roomApi.lobbyStatus(roomCode, requestId, guestAccessToken);
        if (!isMounted) return;

        consecutiveErrorsRef.current = 0;
        const currentStatus = res.status;

        if (currentStatus === "admitted" && res.token && res.livekit_url) {
          setStatus("admitted");
          onAdmittedRef.current({
            token: res.token,
            livekitUrl: res.livekit_url,
            roomCode: res.room_code,
            name: res.name,
            isGuest: res.is_guest,
            guestIdentity: res.guest_identity,
            guestAccessToken: res.guest_access_token || guestAccessToken || undefined,
            lockDocumentPresentation: res.lock_document_presentation,
            canUploadPresentation: res.can_upload_presentation,
          });
          return;
        }

        if (
          currentStatus === "denied" ||
          currentStatus === "expired" ||
          currentStatus === "room_ended"
        ) {
          setStatus(currentStatus);
          return;
        }

        setStatus("pending");
      } catch {
        if (!isMounted) return;
        consecutiveErrorsRef.current += 1;
        // If 3 consecutive network failures occur
        if (consecutiveErrorsRef.current >= 3) {
          setStatus("network_error");
        }
      }

      // Schedule next poll
      if (isMounted) {
        pollTimeout = setTimeout(poll, 2000);
      }
    };

    // First immediate poll
    poll();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [roomCode, requestId, enabled, guestAccessToken]);

  return {
    status,
    elapsedSeconds,
  };
}
