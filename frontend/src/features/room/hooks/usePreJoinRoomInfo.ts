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
      setIsLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        setIsLoading(true);
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

    fetchInfo();

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  return { roomInfo, isLoading, error };
}
