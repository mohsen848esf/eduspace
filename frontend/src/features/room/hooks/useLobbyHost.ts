import { useCallback, useEffect, useRef, useState } from "react";
import { roomApi, type LobbyRequest } from "../api/room.api";

interface UseLobbyHostOptions {
  roomCode: string | null;
  isHost?: boolean;
  canModerate?: boolean;
}

export function useLobbyHost({ roomCode, isHost, canModerate }: UseLobbyHostOptions) {
  const isAllowed = canModerate !== undefined ? canModerate : isHost;
  const [requests, setRequests] = useState<LobbyRequest[]>([]);
  const [admittingId, setAdmittingId] = useState<number | null>(null);
  const [denyingId, setDenyingId] = useState<number | null>(null);
  const [isBatchAction, setIsBatchAction] = useState(false);
  const isPollingRef = useRef(false);

  const fetchLobby = useCallback(async () => {
    if (!roomCode || !isAllowed || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const res = await roomApi.lobbyList(roomCode);
      setRequests(res.requests || []);
    } catch {
      // Swallowed on periodic polling
    } finally {
      isPollingRef.current = false;
    }
  }, [roomCode, isAllowed]);

  // Polling loop
  useEffect(() => {
    if (!roomCode || !isAllowed) return;

    fetchLobby();
    const interval = setInterval(fetchLobby, 3000);
    return () => clearInterval(interval);
  }, [roomCode, isAllowed, fetchLobby]);

  const admit = useCallback(
    async (requestId: number) => {
      if (!roomCode) return;
      setAdmittingId(requestId);
      try {
        await roomApi.lobbyAdmit(roomCode, requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (e) {
        console.error("Failed to admit participant", e);
      } finally {
        setAdmittingId(null);
      }
    },
    [roomCode],
  );

  const deny = useCallback(
    async (requestId: number) => {
      if (!roomCode) return;
      setDenyingId(requestId);
      try {
        await roomApi.lobbyDeny(roomCode, requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (e) {
        console.error("Failed to deny participant", e);
      } finally {
        setDenyingId(null);
      }
    },
    [roomCode],
  );

  const admitAll = useCallback(async () => {
    if (!roomCode) return;
    setIsBatchAction(true);
    try {
      await roomApi.lobbyAdmitAll(roomCode);
      setRequests([]);
    } catch (e) {
      console.error("Failed to admit all", e);
    } finally {
      setIsBatchAction(false);
    }
  }, [roomCode]);

  const denyAll = useCallback(async () => {
    if (!roomCode) return;
    setIsBatchAction(true);
    try {
      await roomApi.lobbyDenyAll(roomCode);
      setRequests([]);
    } catch (e) {
      console.error("Failed to deny all", e);
    } finally {
      setIsBatchAction(false);
    }
  }, [roomCode]);

  return {
    requests,
    count: requests.length,
    admittingId,
    denyingId,
    isBatchAction,
    admit,
    deny,
    admitAll,
    denyAll,
    refresh: fetchLobby,
  };
}
