import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import recordingsApi, {
  type Recording,
  type RecordingQuality,
  type RoomRecordingStatus,
} from "../api/recordings.api";

const POLL_MS = 2500;

interface UseRoomRecordingOptions {
  roomCode: string | null;
  isHost: boolean;
}

/**
 * Drives the in-room recording UI: polls status, exposes start/stop/pause/resume,
 * and surfaces the latest Recording object so the topbar button can render the
 * right state.
 *
 * Polling is gated by `isHost` so participants never hit the endpoint when the
 * server would 403 them anyway.
 */
export function useRoomRecording({ roomCode, isHost }: UseRoomRecordingOptions) {
  const { t } = useTranslation("recordings");
  const [status, setStatus] = useState<RoomRecordingStatus>({
    status: "idle",
    recording: null,
  });
  const [isMutating, setIsMutating] = useState(false);
  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomCode || !isHost) return;
    try {
      const next = await recordingsApi.roomStatus(roomCode);
      if (!cancelled.current) setStatus(next);
    } catch {
      // 403 (we're not a participant anymore) or 404 (room gone). Don't toast.
    }
  }, [roomCode, isHost]);

  useEffect(() => {
    cancelled.current = false;
    refresh();
    if (!roomCode || !isHost) return;
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, [refresh, roomCode, isHost]);

  const wrapMutation = useCallback(
    async <T extends Recording>(
      fn: () => Promise<T>,
      errorKey:
        | "errorStart"
        | "errorStop"
        | "errorPause"
        | "errorResume",
    ): Promise<T | null> => {
      if (!roomCode || isMutating) return null;
      setIsMutating(true);
      try {
        const next = await fn();
        // Mutation's response is the source of truth for the UI; we still
        // poll a moment later to pick up webhook-driven status flips.
        setStatus({ status: next.status, recording: next });
        window.setTimeout(refresh, 500);
        return next;
      } catch (err: any) {
        const detail = err?.response?.data?.error;
        if (
          err?.response?.status === 409 &&
          /still starting/i.test(detail || "")
        ) {
          toast.error(t("controls.tooEarly"));
        } else {
          toast.error(detail || t(`controls.${errorKey}`));
        }
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [roomCode, isMutating, refresh, t],
  );

  const start = useCallback(
    (quality: RecordingQuality) =>
      wrapMutation(
        () => recordingsApi.start(roomCode!, quality),
        "errorStart",
      ),
    [roomCode, wrapMutation],
  );

  const stop = useCallback(
    () => wrapMutation(() => recordingsApi.stop(roomCode!), "errorStop"),
    [roomCode, wrapMutation],
  );

  const pause = useCallback(
    () => wrapMutation(() => recordingsApi.pause(roomCode!), "errorPause"),
    [roomCode, wrapMutation],
  );

  const resume = useCallback(
    () => wrapMutation(() => recordingsApi.resume(roomCode!), "errorResume"),
    [roomCode, wrapMutation],
  );

  return {
    status,
    isMutating,
    start,
    stop,
    pause,
    resume,
    refresh,
  };
}
