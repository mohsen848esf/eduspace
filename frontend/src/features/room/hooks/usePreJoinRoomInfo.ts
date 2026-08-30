import { getApiErrorData } from "@/lib/api/errors";
import { useState, useEffect } from "react";
import { roomApi } from "../api/room.api";
import type { RoomInfo } from "../schemas/room.schema";

export function usePreJoinRoomInfo(roomCode: string) {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!roomCode) {
      return;
    }

    const fetchInfo = async () => {
      try {
        const data = await roomApi.getRoom(roomCode);
        if (!cancelled) {
          setRoomInfo(data);
          setError(null);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setError(getApiErrorData(error)?.detail || (error instanceof Error ? error.message : undefined) || "Failed to load room details");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const fetchTimer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchInfo();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(fetchTimer);
    };
  }, [roomCode]);

  return { roomInfo, isLoading: roomCode ? isLoading : false, error };
}
