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

const POLL_MS = 4500;
/**
 * Slower poll for non-hosts. They only consume the read-only state to
 * render the "this call is being recorded" indicator.
 */
const POLL_MS_PARTICIPANT = 7000;
/**
 * Permission grants change rarely (host clicks a switch).
 */
const POLL_MS_PERMISSION = 10000;

interface UseRoomRecordingOptions {
  roomCode: string | null;
  isHost: boolean;
}

// Module-level registry so multiple mounting components share a single polling loop
const pollRegistry = new Map<
  string,
  {
    subscribers: number;
    statusTimer: number | null;
    permTimer: number | null;
    inFlightStatus: boolean;
    inFlightPerm: boolean;
  }
>();

/**
 * Drives the in-room recording UI: polls status, exposes start/stop/pause/resume,
 * and surfaces the latest Recording object so the topbar button can render the
 * right state.
 */
export function useRoomRecording({ roomCode, isHost }: UseRoomRecordingOptions) {
  const { t } = useTranslation("recordings");
  const status = useActiveRecordingStore((s) => s.status);
  const setStatus = useActiveRecordingStore((s) => s.setStatus);
  const permission = useActiveRecordingStore((s) => s.permission);
  const setPermission = useActiveRecordingStore((s) => s.setPermission);
  const [isMutating, setIsMutating] = useState(false);
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
  const activeModeRef = useRef<"server" | "client-upload" | "client-download" | null>(null);
  const localBlobsRef = useRef<Blob[]>([]);

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
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("access_token");
    if (!roomCode || isClientRecording || !hasToken) return;
    const entry = pollRegistry.get(roomCode);
    if (entry && entry.inFlightStatus) return;
    if (entry) entry.inFlightStatus = true;
    try {
      const next = await recordingsApi.roomStatus(roomCode);
      setStatus(next);
    } catch {
      // Silent
    } finally {
      if (entry) entry.inFlightStatus = false;
    }
  }, [roomCode, isClientRecording, setStatus]);

  const refreshPermission = useCallback(async () => {
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("access_token");
    if (!roomCode || !hasToken) return;
    const entry = pollRegistry.get(roomCode);
    if (entry && entry.inFlightPerm) return;
    if (entry) entry.inFlightPerm = true;
    try {
      const next = await recordingsApi.getRecordingPermission(roomCode);
      setPermission(next);
    } catch {
      // Silent
    } finally {
      if (entry) entry.inFlightPerm = false;
    }
  }, [roomCode, setPermission]);

  // Unified singleton timer registration per roomCode
  useEffect(() => {
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("access_token");
    if (!roomCode || !hasToken) return;

    let entry = pollRegistry.get(roomCode);
    if (!entry) {
      entry = {
        subscribers: 0,
        statusTimer: null,
        permTimer: null,
        inFlightStatus: false,
        inFlightPerm: false,
      };
      pollRegistry.set(roomCode, entry);
    }

    entry.subscribers += 1;

    // Start single interval loop if this is the active coordinator
    if (entry.statusTimer === null) {
      refresh();
      const interval = isHost ? POLL_MS : POLL_MS_PARTICIPANT;
      entry.statusTimer = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        refresh();
      }, interval);
    }

    if (entry.permTimer === null) {
      refreshPermission();
      entry.permTimer = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        refreshPermission();
      }, POLL_MS_PERMISSION);
    }

    return () => {
      const current = pollRegistry.get(roomCode);
      if (current) {
        current.subscribers -= 1;
        if (current.subscribers <= 0) {
          if (current.statusTimer !== null) window.clearInterval(current.statusTimer);
          if (current.permTimer !== null) window.clearInterval(current.permTimer);
          pollRegistry.delete(roomCode);
        }
      }
    };
  }, [roomCode, isHost, refresh, refreshPermission]);

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

  const cleanupClientRecording = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
    }
    const micStream = micStreamRef.current;
    if (micStream) {
      micStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      micStreamRef.current = null;
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsClientRecording(false);
    activeModeRef.current = null;
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const stop = useCallback(
    async () => {
      if (isClientRecording) {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        } else {
          cleanupClientRecording();
        }
        toast.success(t("controls.stopped", "Recording stopped"), { icon: "🎥" });
        return null;
      } else {
        activeModeRef.current = null;
        return wrapMutation(() => recordingsApi.stop(roomCode!), "errorStop");
      }
    },
    [roomCode, isClientRecording, wrapMutation, t, cleanupClientRecording],
  );

  const start = useCallback(
    async (
      quality: RecordingQuality,
      mode: "server" | "client-upload" | "client-download" = "client-upload",
    ) => {
      if (!roomCode || isMutating) return null;
      setIsMutating(true);
      try {
        activeModeRef.current = mode;

        if (mode === "server") {
          const rec = await wrapMutation(
            () => recordingsApi.start(roomCode, quality),
            "errorStart",
          );
          return rec;
        }

        // 1. Try to acquire DisplayMedia for Client-Side Recording
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as any,
          audio: true,
          preferCurrentTab: true,
          selfBrowserSurface: "include",
        } as any);

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
        localBlobsRef.current = [];

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
            const currentMode = activeModeRef.current;
            if (currentMode === "client-upload") {
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
            } else if (currentMode === "client-download") {
              localBlobsRef.current.push(event.data);
            }
          }
        };

        recorder.onstop = async () => {
          const token = activeTokenRef.current;
          const currentMode = activeModeRef.current;

          if (currentMode === "client-upload") {
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
          } else if (currentMode === "client-download") {
            try {
              const blob = new Blob(localBlobsRef.current, { type: "video/webm" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `recording_${roomCode || "room"}_${Date.now()}.webm`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (dlErr) {
              console.error("Failed to download recording file", dlErr);
            }
            localBlobsRef.current = [];

            if (token) {
              try {
                await recordingsApi.remove(token);
              } catch (e) {
                console.error("Failed to clean up temporary recording database entry", e);
              }
            }
            if (!cancelled.current) {
              setStatus({ status: "idle", recording: null });
              setInFlight(null);
            }
          }

          // Trigger cleanup
          cleanupClientRecording();
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
        console.warn("Client-side recording failed or cancelled", err);
        setIsMutating(false);
        if (err.name === "NotAllowedError") {
          // User cancelled screen selection - stop the flow and don't fallback
          return null;
        }
        if (mode === "client-upload") {
          // Fallback to server-side recording
          return wrapMutation(
            () => recordingsApi.start(roomCode!, quality),
            "errorStart",
          );
        } else {
          toast.error(t("controls.errorStart"));
          return null;
        }
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
