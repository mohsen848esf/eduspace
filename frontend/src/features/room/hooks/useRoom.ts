import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { roomApi } from "../api/room.api";
import { useRoomStore } from "../store/roomStore";
import type { CreateRoomInput } from "../schemas/room.schema";
import { useBackgroundStore } from "../store/backgroundStore";

interface ApiErrorBody {
  error?: string;
  code?: string;
}

function readApiError(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return {
      message: error.response?.data?.error || error.message,
      code: error.response?.data?.code,
      status: error.response?.status,
    };
  }
  return {
    message: error instanceof Error ? error.message : undefined,
    code: undefined,
    status: undefined,
  };
}

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
      } catch (err: unknown) {
        const apiError = readApiError(err);
        const msg = apiError.message || t("join.createFailed");
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
            isCoHost: res.is_co_host || false,
            isGuest: false,
            requireApproval: res.require_approval,
            isLocked: res.is_locked,
            maxParticipants: res.max_participants,
            durationLimitMinutes: res.duration_limit_minutes,
            isDurationLimited: res.is_duration_limited,
            muteMicOnJoin: res.mute_mic_on_join,
            muteCamOnJoin: res.mute_cam_on_join,
            lockScreenShare: res.lock_screen_share,
            lockMicrophone: res.lock_microphone,
            lockCamera: res.lock_camera,
            lockDocumentPresentation: res.lock_document_presentation,
            canShareScreen: res.can_share_screen,
            canUseCamera: res.can_use_camera,
            canUseMicrophone: res.can_use_microphone,
            canUploadPresentation: res.can_upload_presentation,
          });
        }
        return res;
      } catch (err: unknown) {
        const apiError = readApiError(err);
        const msg = apiError.message || t("join.joinFailed");
        setError(msg);
        throw Object.assign(new Error(msg), {
          code: apiError.code,
          status: apiError.status,
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
            guestAccessToken: res.guest_access_token,
            requireApproval: res.require_approval,
            isLocked: res.is_locked,
            maxParticipants: res.max_participants,
            durationLimitMinutes: res.duration_limit_minutes,
            isDurationLimited: res.is_duration_limited,
            muteMicOnJoin: res.mute_mic_on_join,
            muteCamOnJoin: res.mute_cam_on_join,
            lockScreenShare: res.lock_screen_share,
            lockMicrophone: res.lock_microphone,
            lockCamera: res.lock_camera,
            lockDocumentPresentation: res.lock_document_presentation,
            canShareScreen: res.can_share_screen,
            canUseCamera: res.can_use_camera,
            canUseMicrophone: res.can_use_microphone,
            canUploadPresentation: res.can_upload_presentation,
          });
        }
        return res;
      } catch (err: unknown) {
        const apiError = readApiError(err);
        const msg = apiError.message || t("join.joinFailed");
        setError(msg);
        throw Object.assign(new Error(msg), {
          code: apiError.code,
          status: apiError.status,
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
