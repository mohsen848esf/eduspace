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
  enabled: boolean;
  onAdmitted: (data: {
    token: string;
    livekitUrl: string;
    roomCode: string;
    name: string;
    isGuest?: boolean;
    guestIdentity?: string;
  }) => void;
}

export function useLobbyWaiting({
  roomCode,
  requestId,
  enabled,
  onAdmitted,
}: UseLobbyWaitingOptions) {
  const [status, setStatus] = useState<LobbyWaitingStatus>("pending");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const consecutiveErrorsRef = useRef(0);
  const onAdmittedRef = useRef(onAdmitted);
  onAdmittedRef.current = onAdmitted;

  // Elapsed timer
  useEffect(() => {
    if (!enabled || !requestId || status !== "pending") return;
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled, requestId, status]);

  // Polling loop
  useEffect(() => {
    if (!enabled || !requestId || !roomCode) return;

    let isMounted = true;
    let pollTimeout: any = null;

    const poll = async () => {
      try {
        const res = await roomApi.lobbyStatus(roomCode, requestId);
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
      } catch (err: any) {
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
  }, [roomCode, requestId, enabled]);

  return {
    status,
    elapsedSeconds,
  };
}
