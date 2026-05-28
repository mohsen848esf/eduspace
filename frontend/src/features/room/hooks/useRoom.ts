import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roomApi } from "../api/room.api";
import { useRoomStore } from "../store/roomStore";
import type { CreateRoomInput } from "../schemas/room.schema";
import { useBackgroundStore } from "../store/backgroundStore";

export function useRoom() {
  const navigate = useNavigate();
  const { t } = useTranslation("room");
  const { setRoom, clearRoom } = useRoomStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(
    async (data: CreateRoomInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await roomApi.create(data);
        setRoom({
          token: res.token,
          livekitUrl: res.livekit_url,
          roomCode: res.room_code,
          roomName: res.name,
          isHost: true,
        });
        navigate(`/room/${res.room_code}`);
      } catch (err: any) {
        setError(err.response?.data?.error || t("join.createFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setRoom, t],
  );

  const joinRoom = useCallback(
    async (room_code: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await roomApi.join(room_code);
        setRoom({
          token: res.token,
          livekitUrl: res.livekit_url,
          roomCode: res.room_code,
          roomName: res.name,
          isHost: res.is_host || false,
        });
        navigate(`/room/${res.room_code}`);
      } catch (err: any) {
        setError(err.response?.data?.error || t("join.joinFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setRoom, t],
  );

  const leaveRoom = useCallback(async () => {
    const { roomCode } = useRoomStore.getState();

    // Stop all media devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      if (videoDevices.length > 0) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
    } catch {
      /* swallow */
    }

    // Reset background
    useBackgroundStore.getState().setBackground("none");

    // Leave room on backend
    if (roomCode) {
      try {
        await roomApi.leave(roomCode);
      } catch {
        /* swallow */
      }
    }

    clearRoom();
    navigate("/dashboard");
  }, [navigate, clearRoom]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    clearError,
  };
}
