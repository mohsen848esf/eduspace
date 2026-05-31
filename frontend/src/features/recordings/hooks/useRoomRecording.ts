import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import recordingsApi, {
  type Recording,
  type RecordingQuality,
  type RoomRecordingPermission,
  type RoomRecordingStatus,
} from "../api/recordings.api";
import { useActiveRecordingStore } from "../store/activeRecordingStore";

const POLL_MS = 2500;
/**
 * Slower poll for non-hosts. They only consume the read-only state to
 * render the "this call is being recorded" indicator, so 5s is plenty.
 */
const POLL_MS_PARTICIPANT = 5000;
/**
 * Permission grants change rarely (host clicks a switch). 5s is a good
 * balance between "feels live" and "doesn't hammer the endpoint".
 */
const POLL_MS_PERMISSION = 5000;

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
 *
 * Side effect: keeps the activeRecordingStore in sync. When a recording
 * finishes (transitions to completed/failed), its token is moved from
 * `inFlightToken` to `pendingEditToken` so the disconnect flow can take
 * the host to the editor after they leave the call — instead of yanking
 * them out of an active conversation.
 */
export function useRoomRecording({ roomCode, isHost }: UseRoomRecordingOptions) {
  const { t } = useTranslation("recordings");
  const [status, setStatus] = useState<RoomRecordingStatus>({
    status: "idle",
    recording: null,
  });
  const [permission, setPermission] = useState<RoomRecordingPermission>({
    can_control: false,
    is_host: false,
    grants: null,
  });
  const [isMutating, setIsMutating] = useState(false);
  const cancelled = useRef(false);
  const lastTokenRef = useRef<string | null>(null);
  const setInFlight = useActiveRecordingStore((s) => s.setInFlight);
  const setPendingEdit = useActiveRecordingStore((s) => s.setPendingEdit);

  // The host implicitly can always control. For non-hosts, the server
  // is the source of truth via the polled permission endpoint.
  const canControl = isHost || permission.can_control;

  // Reflect status changes into the cross-component store.
  useEffect(() => {
    if (!isHost) return;
    const rec = status.recording;
    if (!rec) {
      setInFlight(null);
      return;
    }
    if (
      rec.status === "starting" ||
      rec.status === "recording" ||
      rec.status === "paused" ||
      rec.status === "processing"
    ) {
      setInFlight(rec.public_token);
    } else if (rec.status === "completed" || rec.status === "failed") {
      // Only flag for-edit on the moment of transition (token-newness check)
      // so revisits / re-polls don't keep re-triggering.
      if (rec.public_token !== lastTokenRef.current) {
        lastTokenRef.current = rec.public_token;
        setInFlight(null);
        if (rec.status === "completed") setPendingEdit(rec.public_token);
      }
    }
  }, [status.recording, isHost, setInFlight, setPendingEdit]);

  const refresh = useCallback(async () => {
    // Both hosts and participants poll the read-only status endpoint:
    // hosts because they drive the controls, participants so the room
    // surface can render a "this call is being recorded" indicator.
    if (!roomCode) return;
    try {
      const next = await recordingsApi.roomStatus(roomCode);
      if (!cancelled.current) setStatus(next);
    } catch {
      // 403 / 404 — don't toast. The endpoint will 403 only if the user
      // isn't a participant, which means they shouldn't be in the call
      // anyway; silent is correct.
    }
  }, [roomCode]);

  /**
   * Pull the recording-control permission for this user. Hosts use the
   * `grants` list to render the per-participant toggle; non-hosts use
   * `can_control` to decide whether to show the record buttons.
   */
  const refreshPermission = useCallback(async () => {
    if (!roomCode) return;
    try {
      const next = await recordingsApi.getRecordingPermission(roomCode);
      if (!cancelled.current) setPermission(next);
    } catch {
      // Silent — 403 here means the user isn't a participant and the
      // outer guard will already kick them out of the room view.
    }
  }, [roomCode]);

  useEffect(() => {
    cancelled.current = false;
    refresh();
    if (!roomCode) return;
    const interval = isHost ? POLL_MS : POLL_MS_PARTICIPANT;
    const id = window.setInterval(refresh, interval);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, [refresh, roomCode, isHost]);

  // Permission polling runs separately on its own (slower) cadence so
  // the cheaper status poll stays unaffected.
  useEffect(() => {
    if (!roomCode) return;
    refreshPermission();
    const id = window.setInterval(refreshPermission, POLL_MS_PERMISSION);
    return () => window.clearInterval(id);
  }, [refreshPermission, roomCode]);

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
    permission,
    canControl,
    isMutating,
    start,
    stop,
    pause,
    resume,
    refresh,
    refreshPermission,
  };
}
