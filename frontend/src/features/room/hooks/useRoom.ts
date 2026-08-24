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
          isGuest: false,
        });
        navigate(`/room/${res.room_code}`);
        return res;
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || t("join.createFailed");
        setError(msg);
        console.error("Failed to create room:", err);
        throw err;
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
        if ("waiting" in res && res.waiting) {
          return res;
        }
        if ("token" in res) {
          setRoom({
            token: res.token,
            livekitUrl: res.livekit_url,
            roomCode: res.room_code,
            roomName: res.name,
            isHost: res.is_host || false,
            isGuest: false,
            requireApproval: res.require_approval,
            isLocked: res.is_locked,
          });
        }
        return res;
      } catch (err: any) {
        const errorCode = err.response?.data?.code;
        const msg = err.response?.data?.error || t("join.joinFailed");
        setError(msg);
        throw Object.assign(new Error(msg), {
          code: errorCode,
          status: err.response?.status,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [setRoom, t],
  );

  const joinRoomGuest = useCallback(
    async (room_code: string, display_name: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await roomApi.guestJoin(room_code, display_name);
        if ("waiting" in res && res.waiting) {
          return res;
        }
        if ("token" in res) {
          setRoom({
            token: res.token,
            livekitUrl: res.livekit_url,
            roomCode: res.room_code,
            roomName: res.name,
            isHost: false,
            isGuest: true,
            guestIdentity: res.guest_identity,
            requireApproval: res.require_approval,
            isLocked: res.is_locked,
          });
        }
        return res;
      } catch (err: any) {
        const errorCode = err.response?.data?.code;
        const msg = err.response?.data?.error || t("join.joinFailed");
        setError(msg);
        throw Object.assign(new Error(msg), {
          code: errorCode,
          status: err.response?.status,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [setRoom, t],
  );

  const leaveRoom = useCallback(
    async ({ redirectTo }: { redirectTo?: string | null } = {}) => {
      const { roomCode, isGuest, guestIdentity } = useRoomStore.getState();

      // Reset background
      useBackgroundStore.getState().setBackground("none");

      // Leave room on backend
      if (roomCode) {
        try {
          await roomApi.leave(roomCode, guestIdentity || undefined);
        } catch {
          /* swallow */
        }
      }

      clearRoom();
      if (redirectTo !== null) {
        navigate(redirectTo ?? (isGuest ? "/login" : "/dashboard"));
      }
    },
    [navigate, clearRoom],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    createRoom,
    joinRoom,
    joinRoomGuest,
    leaveRoom,
    clearError,
  };
}
