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

  // Client-side recording states and refs
  const [isClientRecording, setIsClientRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunkIndexRef = useRef<number>(0);
  const uploadPromisesRef = useRef<Promise<any>[]>([]);
  const activeTokenRef = useRef<string | null>(null);

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
      if (rec.public_token !== lastTokenRef.current) {
        lastTokenRef.current = rec.public_token;
        setInFlight(null);
        if (rec.status === "completed") setPendingEdit(rec.public_token);
      }
    }
  }, [status.recording, isHost, setInFlight, setPendingEdit]);

  const refresh = useCallback(async () => {
    // Skip status polling if local client-side recording is active
    if (!roomCode || isClientRecording) return;
    try {
      const next = await recordingsApi.roomStatus(roomCode);
      if (!cancelled.current) setStatus(next);
    } catch {
      // Silent
    }
  }, [roomCode, isClientRecording]);

  const refreshPermission = useCallback(async () => {
    if (!roomCode) return;
    try {
      const next = await recordingsApi.getRecordingPermission(roomCode);
      if (!cancelled.current) setPermission(next);
    } catch {
      // Silent
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

  // Permission polling runs separately
  useEffect(() => {
    if (!roomCode) return;
    refreshPermission();
    const id = window.setInterval(refreshPermission, POLL_MS_PERMISSION);
    return () => window.clearInterval(id);
  }, [refreshPermission, roomCode]);

  // Cleanup screen capture and mic streams on unmount
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const micStream = micStreamRef.current;
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, []);

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

  const stop = useCallback(
    async () => {
      if (isClientRecording) {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
        const stream = streamRef.current;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        const micStream = micStreamRef.current;
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop());
          micStreamRef.current = null;
        }
        const audioCtx = audioCtxRef.current;
        if (audioCtx) {
          audioCtx.close().catch(() => {});
          audioCtxRef.current = null;
        }
        setIsClientRecording(false);
        activeTokenRef.current = null;
        streamRef.current = null;
        mediaRecorderRef.current = null;
        toast.success(t("controls.stopped", "Recording stopped"), { icon: "🎥" });
        return null;
      } else {
        return wrapMutation(() => recordingsApi.stop(roomCode!), "errorStop");
      }
    },
    [roomCode, isClientRecording, wrapMutation, t],
  );

  const start = useCallback(
    async (quality: RecordingQuality) => {
      if (!roomCode || isMutating) return null;
      setIsMutating(true);
      try {
        // 1. Try to acquire DisplayMedia for Client-Side Recording
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as any,
          audio: true,
        });

        let combinedStream = displayStream;

        // Try to mix local microphone audio
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;

          const displayAudioTracks = displayStream.getAudioTracks();
          const micAudioTracks = micStream.getAudioTracks();

          if (displayAudioTracks.length > 0 && micAudioTracks.length > 0) {
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtxClass();
            audioCtxRef.current = audioCtx;

            const displaySource = audioCtx.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
            const micSource = audioCtx.createMediaStreamSource(new MediaStream([micAudioTracks[0]]));
            const destination = audioCtx.createMediaStreamDestination();

            displaySource.connect(destination);
            micSource.connect(destination);

            const videoTrack = displayStream.getVideoTracks()[0];
            const mixedAudioTrack = destination.stream.getAudioTracks()[0];

            combinedStream = new MediaStream([videoTrack, mixedAudioTrack]);
          } else if (micAudioTracks.length > 0) {
            const videoTrack = displayStream.getVideoTracks()[0];
            combinedStream = new MediaStream([videoTrack, micAudioTracks[0]]);
          }
        } catch (micErr) {
          console.warn("Could not acquire microphone stream for recording mix", micErr);
        }

        streamRef.current = combinedStream;
        chunkIndexRef.current = 0;
        uploadPromisesRef.current = [];

        // 2. Start the database recording session on Django backend
        const initRec = await recordingsApi.startClient(roomCode, quality);
        activeTokenRef.current = initRec.public_token;
        setStatus({ status: initRec.status, recording: initRec });
        setInFlight(initRec.public_token);
        setIsClientRecording(true);

        const options = { mimeType: "video/webm;codecs=vp8,opus" };
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(combinedStream, options);
        } catch (e) {
          recorder = new MediaRecorder(combinedStream);
        }

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            const chunk = event.data;
            const index = chunkIndexRef.current;
            chunkIndexRef.current++;
            const token = activeTokenRef.current;
            if (token) {
              const uploadPromise = recordingsApi.uploadChunk(token, chunk, index).catch((err) => {
                console.error(`Failed to upload chunk ${index}`, err);
              });
              uploadPromisesRef.current.push(uploadPromise);
            }
          }
        };

        recorder.onstop = async () => {
          const token = activeTokenRef.current;
          await Promise.all(uploadPromisesRef.current);
          if (token) {
            try {
              const next = await recordingsApi.completeClient(token);
              if (!cancelled.current) {
                setStatus({ status: next.status, recording: next });
                setInFlight(null);
                setPendingEdit(token);
              }
            } catch (e) {
              console.error("Failed to complete client recording", e);
              toast.error(t("controls.errorStop"));
            }
          }
        };

        // Start chunked recording in 10-second intervals
        recorder.start(10000);

        // Listen for screen share stopped by user in browser UI
        displayStream.getVideoTracks()[0].onended = () => {
          stop();
        };

        toast.success(t("controls.started", "Recording started (Client-side)"), { icon: "🎥" });
        return initRec;
      } catch (err: any) {
        console.warn("Client-side recording failed or cancelled, falling back to server-side", err);
        
        // Fallback to server-side recording
        setIsMutating(false); // reset so wrapMutation is allowed to execute
        return wrapMutation(
          () => recordingsApi.start(roomCode!, quality),
          "errorStart",
        );
      } finally {
        setIsMutating(false);
      }
    },
    [roomCode, isMutating, wrapMutation, setInFlight, setPendingEdit, t, stop],
  );

  const pause = useCallback(
    async () => {
      if (isClientRecording) {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "recording") {
          recorder.pause();
          setStatus((prev) => prev.recording ? {
            status: "paused",
            recording: { ...prev.recording, status: "paused" },
          } : prev);
          toast.success(t("controls.paused", "Recording paused"), { icon: "🎥" });
        }
        return null;
      } else {
        return wrapMutation(() => recordingsApi.pause(roomCode!), "errorPause");
      }
    },
    [roomCode, isClientRecording, wrapMutation, t],
  );

  const resume = useCallback(
    async () => {
      if (isClientRecording) {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "paused") {
          recorder.resume();
          setStatus((prev) => prev.recording ? {
            status: "recording",
            recording: { ...prev.recording, status: "recording" },
          } : prev);
          toast.success(t("controls.resumed", "Recording resumed"), { icon: "🎥" });
        }
        return null;
      } else {
        return wrapMutation(() => recordingsApi.resume(roomCode!), "errorResume");
      }
    },
    [roomCode, isClientRecording, wrapMutation, t],
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
