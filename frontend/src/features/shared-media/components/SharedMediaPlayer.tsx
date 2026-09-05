import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, LoaderCircle, Maximize, Minimize, Pause, Pin, PinOff, Play, RotateCcw, RotateCw, ShieldCheck, Square, Volume1, Volume2, VolumeX } from "lucide-react";
import type Hls from "hls.js";
import type { Room } from "livekit-client";
import { sharedMediaApi, type SharedPlaybackCommand } from "../api/shared-media.api";
import { encodePlaybackInvalidation } from "../lib/realtime";
import { chooseDriftCorrection, chooseFrontierAction, estimateServerNowMs, expectedPlaybackPositionMs } from "../lib/syncMath";
import {
  bufferedAheadMs,
  STRICT_HEALTHY_STABILITY_MS,
  STRICT_UNHEALTHY_GRACE_MS,
  strictReadinessState,
  summarizePlaybackReadiness,
} from "../lib/playbackHealth";
import { useSharedPlaybackHealth } from "../hooks/useSharedPlaybackHealth";
import { useSharedPlaybackStore } from "../store/sharedPlaybackStore";
import { SharedPlaybackReadiness } from "./SharedPlaybackReadiness";

interface Props {
  room: Room;
  roomCode: string;
  guestAccessToken?: string | null;
  canModerate: boolean;
  moderatorIdentities?: string[];
}

function formatMediaTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const MAX_AUTOMATIC_RECOVERY_ATTEMPTS = 3;
const POINTER_IDLE_HIDE_MS = 2_500;
interface QualityOption {
  index: number;
  height: number;
  label: string;
}

export function SharedMediaPlayer({ room, roomCode, guestAccessToken, canModerate, moderatorIdentities = [] }: Props) {
  const { t } = useTranslation("room");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const deliveryRenditionRevisionRef = useRef<{ playbackId: number; revision: string } | null>(null);
  const automaticRecoveryAttemptsRef = useRef(0);
  const commandPendingRef = useRef(false);
  const strictUnhealthySinceRef = useRef<number | null>(null);
  const strictHealthySinceRef = useRef<number | null>(null);
  const pointerIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playback = useSharedPlaybackStore((state) => state.playback);
  const playbackId = playback?.id;
  const clockOffsetMs = useSharedPlaybackStore((state) => state.clockOffsetMs);
  const applyPlayback = useSharedPlaybackStore((state) => state.applyPlayback);
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [commandPending, setCommandPending] = useState(false);
  const [deliveryAttempt, setDeliveryAttempt] = useState(0);
  const [waitingForUpload, setWaitingForUpload] = useState(false);
  const [displayPositionMs, setDisplayPositionMs] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsPinned, setControlsPinned] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [touchControlsVisible, setTouchControlsVisible] = useState(false);
  const [controlsFocused, setControlsFocused] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const connectedModeratorIdentities = moderatorIdentities.filter((identity) => (
    identity === room.localParticipant.identity || room.remoteParticipants?.has(identity)
  ));
  const isSyncCoordinator = canModerate && connectedModeratorIdentities[0] === room.localParticipant.identity;
  const interactionChromeVisible = pointerInside || touchControlsVisible || controlsFocused || readinessOpen;
  const expandedControlsVisible = controlsPinned || interactionChromeVisible;

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const registerPointerActivity = useCallback(() => {
    setPointerInside((active) => (active ? active : true));
    if (pointerIdleTimerRef.current) clearTimeout(pointerIdleTimerRef.current);
    pointerIdleTimerRef.current = setTimeout(() => {
      setPointerInside(false);
    }, POINTER_IDLE_HIDE_MS);
  }, []);

  const clearPointerActivity = useCallback(() => {
    if (pointerIdleTimerRef.current) {
      clearTimeout(pointerIdleTimerRef.current);
      pointerIdleTimerRef.current = null;
    }
    setPointerInside(false);
  }, []);

  useEffect(() => () => {
    if (pointerIdleTimerRef.current) clearTimeout(pointerIdleTimerRef.current);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      await stage.requestFullscreen();
    } catch {
      setIsFullscreen(document.fullscreenElement === stage);
    }
  }, []);

  const advertisedQualityOptions = useMemo(() => {
    const renditions = (playback?.asset.renditions ?? []).filter(
      (rendition) => rendition.status === "playable" || rendition.status === "ready",
    );
    const hasFinalRendition = renditions.some((rendition) => rendition.label !== "progressive");
    const candidates = playback?.asset.status === "ready" && hasFinalRendition
      ? renditions.filter((rendition) => rendition.label !== "progressive")
      : renditions;
    const byHeight = new Map<number, QualityOption>();
    candidates.forEach((rendition) => {
      if (rendition.height > 0) {
        byHeight.set(rendition.height, {
          index: -1,
          height: rendition.height,
          label: `${rendition.height}p`,
        });
      }
    });
    return Array.from(byHeight.values()).sort((left, right) => left.height - right.height);
  }, [playback?.asset.renditions, playback?.asset.status]);

  const visibleQualityOptions = useMemo(() => {
    const byHeight = new Map<number, QualityOption>();
    advertisedQualityOptions.forEach((option) => byHeight.set(option.height, option));
    qualityOptions.forEach((option) => byHeight.set(option.height, option));
    return Array.from(byHeight.values()).sort((left, right) => left.height - right.height);
  }, [advertisedQualityOptions, qualityOptions]);

  const requestFreshDelivery = useCallback(() => {
    setMediaReady(false);
    setIsRecovering(true);
    setMasterUrl(null);
    setDeliveryAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!playbackId || !playback) {
      deliveryRenditionRevisionRef.current = null;
      return;
    }
    const revision = [
      playback.asset.status,
      ...(playback.asset.renditions ?? [])
        .filter((rendition) => rendition.status === "playable" || rendition.status === "ready")
        .map((rendition) => `${rendition.label}:${rendition.status}`)
        .sort(),
    ].join("|");
    const previous = deliveryRenditionRevisionRef.current;
    deliveryRenditionRevisionRef.current = { playbackId, revision };
    if (previous?.playbackId === playbackId && previous.revision !== revision) {
      requestFreshDelivery();
    }
  }, [playback, playbackId, requestFreshDelivery]);

  useEffect(() => {
    if (!playbackId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshDelivery = async () => {
      try {
        const delivery = await sharedMediaApi.getPlaybackDelivery(
          roomCode,
          guestAccessToken || undefined,
        );
        if (disposed || delivery.playback_id !== playbackId) return;
        setMasterUrl(delivery.master_url);
        setLoadError(false);
        timer = setTimeout(
          () => void refreshDelivery(),
          Math.max(30_000, delivery.expires_in_seconds * 800),
        );
      } catch {
        if (!disposed) {
          setIsRecovering(false);
          setLoadError(true);
          timer = setTimeout(() => void refreshDelivery(), 5_000);
        }
      }
    };
    void refreshDelivery();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [playbackId, roomCode, guestAccessToken, deliveryAttempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !masterUrl) return;
    let disposed = false;
    let hls: Hls | null = null;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    setMediaReady(false);
    setLoadError(false);
    setQualityOptions([]);
    setSelectedQuality(-1);
    const handleReady = () => {
      if (!disposed) {
        automaticRecoveryAttemptsRef.current = 0;
        setIsRecovering(false);
        setMediaReady(true);
      }
    };
    const handleTimeUpdate = () => {
      if (!disposed) setDisplayPositionMs(video.currentTime * 1_000);
    };
    const handleNativeError = () => {
      if (disposed) return;
      if (automaticRecoveryAttemptsRef.current < MAX_AUTOMATIC_RECOVERY_ATTEMPTS) {
        automaticRecoveryAttemptsRef.current += 1;
        setIsRecovering(true);
        if (recoveryTimer) clearTimeout(recoveryTimer);
        recoveryTimer = setTimeout(requestFreshDelivery, 500);
      } else {
        setIsRecovering(false);
        setLoadError(true);
      }
    };
    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleNativeError);
    video.addEventListener("timeupdate", handleTimeUpdate);
    const attach = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = masterUrl;
          video.load();
          return;
        }
        const { default: HlsClient } = await import("hls.js");
        if (disposed || !HlsClient.isSupported()) {
          if (!disposed) setLoadError(true);
          return;
        }
        hls = new HlsClient({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 60,
          manifestLoadingMaxRetry: 4,
          levelLoadingMaxRetry: 4,
          fragLoadingMaxRetry: 6,
        });
        hlsRef.current = hls;
        hls.on(HlsClient.Events.MEDIA_ATTACHED, () => hls?.loadSource(masterUrl));
        hls.on(HlsClient.Events.MANIFEST_PARSED, () => {
          if (!hls || disposed) return;
          const optionsByLabel = new Map<string, QualityOption>();
          hls.levels.forEach((level, index) => {
            const height = level.height || 0;
            const label = height ? `${height}p` : `${Math.round(level.bitrate / 1_000)} kbps`;
            optionsByLabel.set(label, { index, height, label });
          });
          setQualityOptions(Array.from(optionsByLabel.values()));
          handleReady();
        });
        hls.on(HlsClient.Events.ERROR, (_event, data) => {
          if (!data.fatal || !hls) return;
          if (automaticRecoveryAttemptsRef.current >= MAX_AUTOMATIC_RECOVERY_ATTEMPTS) {
            setIsRecovering(false);
            setLoadError(true);
            return;
          }
          automaticRecoveryAttemptsRef.current += 1;
          setIsRecovering(true);
          setMediaReady(false);
          if (data.type === HlsClient.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          if (data.type === HlsClient.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad(Math.max(0, video.currentTime - 0.5));
            if (recoveryTimer) clearTimeout(recoveryTimer);
            recoveryTimer = setTimeout(() => {
              if (!disposed && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
                requestFreshDelivery();
              }
            }, 2_500);
            return;
          }
          requestFreshDelivery();
        });
        hls.attachMedia(video);
      } catch {
        if (!disposed) setLoadError(true);
      }
    };
    void attach();
    return () => {
      disposed = true;
      if (recoveryTimer) clearTimeout(recoveryTimer);
      hls?.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleNativeError);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeAttribute("src");
      video.load();
    };
  }, [masterUrl, requestFreshDelivery]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted || volume === 0;
  }, [muted, volume]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !playback || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
      const estimatedServerNow = estimateServerNowMs(Date.now(), clockOffsetMs);
      const correction = chooseDriftCorrection(
        playback,
        video.currentTime * 1_000,
        estimatedServerNow,
      );
      setWaitingForUpload((playback.state === "buffering" && playback.buffer_reason === "frontier") || (
        playback.is_growing && correction.expectedPositionMs >= playback.seekable_until_ms
      ));
      setDisplayPositionMs(video.currentTime * 1_000);
      if (correction.kind === "seek") video.currentTime = correction.expectedPositionMs / 1_000;
      video.playbackRate = correction.playbackRate;
      if (
        playback.state === "playing" &&
        estimatedServerNow >= Date.parse(playback.effective_at)
      ) {
        void video.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
      } else if (!video.paused) {
        video.pause();
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [playback, clockOffsetMs]);

  const sendCommand = useCallback(async (
    command: SharedPlaybackCommand["command"],
    deltaMs = 0,
    absolutePositionMs?: number,
    options?: Pick<SharedPlaybackCommand, "sync_policy" | "buffer_reason">,
  ) => {
    if (!playback || commandPendingRef.current) return;
    const positionLimit = command === "PLAY" || command === "SEEK"
      ? playback.seekable_until_ms
      : playback.published_duration_ms;
    const position = Math.max(0, Math.min(
      positionLimit,
      absolutePositionMs ?? ((videoRef.current?.currentTime || 0) * 1_000 + deltaMs),
    ));
    commandPendingRef.current = true;
    setCommandPending(true);
    try {
      const updated = await sharedMediaApi.commandPlayback(roomCode, {
        command,
        expected_version: playback.version,
        position_ms: command === "SET_SYNC_POLICY" ? undefined : Math.round(position),
        lead_time_ms: command === "PLAY" ? 750 : 0,
        ...options,
      });
      if (command === "STOP") useSharedPlaybackStore.getState().reset();
      else applyPlayback(roomCode, updated);
      await room.localParticipant.publishData(
        encodePlaybackInvalidation({
          v: 1,
          type: "SHARED_PLAYBACK_INVALIDATED",
          room_code: roomCode,
          playback_id: updated.id,
          version: updated.version,
          emitted_at: updated.server_now,
        }),
        { reliable: true },
      ).catch(() => undefined);
    } catch {
      const snapshot = await sharedMediaApi.getSnapshot(
        roomCode,
        guestAccessToken || undefined,
      ).catch(() => null);
      if (snapshot) useSharedPlaybackStore.getState().applySnapshot(roomCode, snapshot);
    } finally {
      commandPendingRef.current = false;
      setCommandPending(false);
    }
  }, [applyPlayback, guestAccessToken, playback, room, roomCode]);

  useEffect(() => {
    if (!isSyncCoordinator || !playback || commandPending) return;
    const reconcileFrontier = () => {
      const serverNow = estimateServerNowMs(Date.now(), clockOffsetMs);
      const expectedPosition = expectedPlaybackPositionMs(playback, serverNow);
      const action = chooseFrontierAction(playback, expectedPosition);
      if (action.kind === "buffer") {
        void sendCommand("BUFFERING", 0, action.positionMs, { buffer_reason: "frontier" });
      }
      if (action.kind === "resume") void sendCommand("PLAY", 0, action.positionMs);
    };
    reconcileFrontier();
    const timer = window.setInterval(reconcileFrontier, 500);
    return () => window.clearInterval(timer);
  }, [clockOffsetMs, commandPending, isSyncCoordinator, playback, sendCommand]);

  const createHealthSample = useCallback(() => {
    const video = videoRef.current;
    const estimatedServerNow = estimateServerNowMs(Date.now(), clockOffsetMs);
    const expectedPosition = playback
      ? expectedPlaybackPositionMs(playback, estimatedServerNow)
      : 0;
    const position = Math.max(0, Math.round((video?.currentTime || 0) * 1_000));
    const activeLevelIndex = hlsRef.current?.currentLevel ?? -1;
    const activeLevel = activeLevelIndex >= 0 ? hlsRef.current?.levels[activeLevelIndex] : undefined;
    const qualityLabel = selectedQuality === -1
      ? `Auto${activeLevel?.height ? ` · ${activeLevel.height}p` : ""}`
      : visibleQualityOptions.find((option) => option.height === selectedQuality)?.label || "Auto";
    const status = loadError
      ? "error" as const
      : isRecovering
        ? "recovering" as const
        : needsGesture
          ? "gesture" as const
          : !mediaReady || waitingForUpload || (playback?.state === "playing" && (!video || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA))
            ? "buffering" as const
            : "ready" as const;
    return {
      v: 1 as const,
      type: "SHARED_PLAYBACK_HEALTH" as const,
      room_code: roomCode,
      playback_id: playback?.id || 1,
      position_ms: position,
      expected_position_ms: Math.round(expectedPosition),
      drift_ms: Math.round(expectedPosition - position),
      buffered_ahead_ms: video ? bufferedAheadMs(video) : 0,
      status,
      quality_label: qualityLabel,
      emitted_at: Date.now(),
    };
  }, [clockOffsetMs, isRecovering, loadError, mediaReady, needsGesture, playback, roomCode, selectedQuality, visibleQualityOptions, waitingForUpload]);

  const playbackHealth = useSharedPlaybackHealth({
    room,
    roomCode,
    playbackId,
    canModerate,
    moderatorIdentities,
    createSample: createHealthSample,
  });

  const totalParticipants = (room.remoteParticipants?.size ?? 0) + 1;
  const readinessSummary = summarizePlaybackReadiness(playbackHealth, totalParticipants);
  const strictState = strictReadinessState(readinessSummary);

  useEffect(() => {
    if (!isSyncCoordinator || !playback || commandPending) {
      strictUnhealthySinceRef.current = null;
      strictHealthySinceRef.current = null;
      return;
    }
    const reconcileStrictPolicy = () => {
      const now = Date.now();
      if (
        playback.sync_policy === "continuous" &&
        playback.state === "buffering" &&
        playback.buffer_reason === "readiness"
      ) {
        void sendCommand("PLAY", 0, playback.anchor_position_ms);
        return;
      }
      if (playback.sync_policy !== "strict") {
        strictUnhealthySinceRef.current = null;
        strictHealthySinceRef.current = null;
        return;
      }
      if (playback.state === "playing") {
        strictHealthySinceRef.current = null;
        if (!strictState.shouldBuffer) {
          strictUnhealthySinceRef.current = null;
          return;
        }
        strictUnhealthySinceRef.current ??= now;
        if (now - strictUnhealthySinceRef.current >= STRICT_UNHEALTHY_GRACE_MS) {
          const serverNow = estimateServerNowMs(now, clockOffsetMs);
          const expectedPosition = expectedPlaybackPositionMs(playback, serverNow);
          strictUnhealthySinceRef.current = null;
          void sendCommand(
            "BUFFERING",
            0,
            Math.min(expectedPosition, playback.seekable_until_ms),
            { buffer_reason: "readiness" },
          );
        }
        return;
      }
      strictUnhealthySinceRef.current = null;
      if (playback.state === "buffering" && playback.buffer_reason === "readiness") {
        if (!strictState.canResume) {
          strictHealthySinceRef.current = null;
          return;
        }
        strictHealthySinceRef.current ??= now;
        if (now - strictHealthySinceRef.current >= STRICT_HEALTHY_STABILITY_MS) {
          strictHealthySinceRef.current = null;
          void sendCommand("PLAY", 0, playback.anchor_position_ms);
        }
      } else {
        strictHealthySinceRef.current = null;
      }
    };
    reconcileStrictPolicy();
    const timer = window.setInterval(reconcileStrictPolicy, 500);
    return () => window.clearInterval(timer);
  }, [clockOffsetMs, commandPending, isSyncCoordinator, playback, sendCommand, strictState.canResume, strictState.shouldBuffer]);

  if (!playback) return null;

  const publishedDurationMs = playback.published_duration_ms ?? 0;
  const timelineMaxMs = Math.max(
    1,
    playback.is_growing ? (playback.seekable_until_ms ?? 0) : publishedDurationMs,
  );
  const timelinePositionMs = Math.min(displayPositionMs, timelineMaxMs);
  const playbackStateLabel = t(`sharedMedia.state.${playback.state}`, playback.state);
  const playbackHeading = `${playback.asset.title} — ${playbackStateLabel}`;

  return (
    <div
      ref={stageRef}
      data-testid="shared-media-stage"
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      dir="ltr"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") registerPointerActivity();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") clearPointerActivity();
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== "touch") registerPointerActivity();
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        const target = event.target as Element;
        if (target.closest("[data-player-controls], [data-player-overlay]")) return;
        setTouchControlsVisible((visible) => !visible);
      }}
      onFocusCapture={() => setControlsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setControlsFocused(false);
      }}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" data-player-surface>
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted={muted || volume === 0}
          aria-label={playback.asset.title}
        />

        {canModerate && (
          <div
            data-player-overlay
            data-testid="shared-playback-readiness-chrome"
            className={`absolute inset-0 z-20 transition-[opacity,transform] motion-reduce:transform-none motion-reduce:transition-none [&_details]:pointer-events-auto ${
              interactionChromeVisible
                ? "translate-y-0 opacity-100 duration-200 ease-out"
                : "pointer-events-none -translate-y-1 opacity-0 duration-150 ease-in"
            }`}
          >
            <SharedPlaybackReadiness
              entries={playbackHealth}
              totalParticipants={totalParticipants}
              onOpenChange={setReadinessOpen}
            />
          </div>
        )}

      {!mediaReady && !loadError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-white" role="status" dir="rtl">
          <div className="flex items-center gap-2 rounded-xl bg-black/65 px-4 py-3 text-sm">
            <LoaderCircle className="animate-spin" size={20} aria-hidden />
            {t("sharedMedia.loadingStream", "در حال دریافت جریان ویدئو…")}
          </div>
        </div>
      )}

      {(needsGesture || loadError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-[var(--brand)] px-5 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => {
              setLoadError(false);
              if (loadError) {
                automaticRecoveryAttemptsRef.current = 0;
                requestFreshDelivery();
              }
              void videoRef.current?.play().then(() => setNeedsGesture(false));
            }}
          >
            {loadError ? t("sharedMedia.retry", "تلاش دوباره") : t("sharedMedia.joinPlayback", "ورود به پخش همزمان")}
          </button>
        </div>
      )}

      {waitingForUpload && !loadError && (
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center" role="status" dir="rtl">
          <div className="rounded-xl border border-amber-300/30 bg-black/75 px-4 py-2 text-sm text-amber-100 backdrop-blur">
            {t("sharedMedia.waitingForUpload", "در انتظار رسیدن بخش بعدی ویدئو…")}
          </div>
        </div>
      )}

      {playback.state === "buffering" && playback.buffer_reason === "readiness" && !loadError && (
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center" role="status" dir="rtl">
          <div className="rounded-xl border border-sky-300/30 bg-black/75 px-4 py-2 text-sm text-sky-100 backdrop-blur">
            {t("sharedMedia.waitingForParticipants", "در انتظار همگام‌شدن شرکت‌کنندگان…")}
          </div>
        </div>
      )}

      </div>

      <div
        data-player-controls
        data-testid="shared-media-toolbar"
        data-pinned={controlsPinned ? "true" : "false"}
        data-state={expandedControlsVisible ? "visible" : "hidden"}
        aria-hidden={!expandedControlsVisible}
        inert={!expandedControlsVisible}
        className={`z-30 flex flex-col overflow-hidden text-white transition-[background-color,border-color,border-radius,padding,gap,opacity,transform] motion-reduce:transform-none motion-reduce:transition-none ${
          controlsPinned
            ? "relative w-full shrink-0 gap-1.5 border-t border-white/15 bg-slate-950/95 p-2 duration-200 ease-out sm:gap-2 sm:p-3"
            : expandedControlsVisible
              ? "absolute inset-x-2 bottom-2 gap-1.5 rounded-xl border border-white/15 bg-black/80 p-2 duration-200 ease-out backdrop-blur sm:inset-x-3 sm:bottom-3 sm:gap-2 sm:p-3"
              : "pointer-events-none absolute inset-x-2 bottom-2 translate-y-2 gap-0 rounded-lg border border-transparent bg-black/45 px-2 py-1 opacity-0 duration-150 ease-in sm:inset-x-3 sm:bottom-3"
        }`}
        dir="rtl"
      >
        <div className="flex items-center gap-2" dir="ltr">
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-white/80">
            {formatMediaTime(timelinePositionMs)}
          </span>
          <input
            type="range"
            min={0}
            max={timelineMaxMs}
            step={250}
            value={timelinePositionMs}
            disabled={!canModerate || commandPending || timelineMaxMs <= 1}
            onChange={(event) => {
              const positionMs = Number(event.currentTarget.value);
              setDisplayPositionMs(positionMs);
              void sendCommand("SEEK", 0, positionMs);
            }}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--brand)] disabled:cursor-default disabled:opacity-75"
            aria-label={t("sharedMedia.timeline", "خط زمانی ویدئو")}
          />
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-white/80">
            {formatMediaTime(publishedDurationMs)}
          </span>
        </div>
        <div
          data-testid="shared-media-control-details"
          data-state={expandedControlsVisible ? "visible" : "hidden"}
          aria-hidden={!expandedControlsVisible}
          inert={!expandedControlsVisible}
          className={`grid transition-[grid-template-rows,opacity,transform] motion-reduce:transform-none motion-reduce:transition-none ${
            expandedControlsVisible
              ? "grid-rows-[1fr] translate-y-0 opacity-100 duration-200 ease-out"
              : "pointer-events-none grid-rows-[0fr] translate-y-2 opacity-0 duration-150 ease-in"
          }`}
        >
        <div className="min-h-0 overflow-hidden">
        <div className="flex min-w-0 flex-col gap-2 md:min-h-12 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1 text-start" title={playbackHeading}>
            <p className="truncate whitespace-nowrap text-sm">
              <span className="font-semibold">{playback.asset.title}</span>
              <span className="mx-1.5 text-white/40" aria-hidden>—</span>
              <span className="text-xs text-white/70">{playbackStateLabel}</span>
            </p>
          </div>
          <div
            data-testid="shared-media-controls"
            className="flex w-full min-w-0 flex-col items-stretch gap-2 overflow-hidden md:w-auto md:max-w-[78%] md:shrink-0 md:flex-row md:items-center md:gap-1"
            dir="ltr"
          >
            {canModerate && (
              <div data-testid="shared-media-primary-controls" className="flex items-center justify-center gap-2 md:contents">
                <button type="button" disabled={commandPending} onClick={() => void sendCommand("SEEK", -10_000)} className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-lg bg-white/5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:bg-transparent" aria-label={t("sharedMedia.backTen", "۱۰ ثانیه عقب")}><RotateCcw size={20} /></button>
                <button type="button" disabled={commandPending} onClick={() => void sendCommand(playback.state === "playing" ? "PAUSE" : "PLAY")} className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-full bg-white text-black hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" aria-label={playback.state === "playing" ? t("sharedMedia.pause", "توقف موقت") : t("sharedMedia.play", "پخش")}>{playback.state === "playing" ? <Pause size={20} /> : <Play size={20} />}</button>
                <button type="button" disabled={commandPending} onClick={() => void sendCommand("SEEK", 10_000)} className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-lg bg-white/5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:bg-transparent" aria-label={t("sharedMedia.forwardTen", "۱۰ ثانیه جلو")}><RotateCw size={20} /></button>
                <button type="button" disabled={commandPending} onClick={() => void sendCommand("STOP")} className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-lg bg-red-500/10 text-red-300 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:bg-transparent" aria-label={t("sharedMedia.stopForEveryone", "پایان پخش برای همه")}><Square size={18} /></button>
              </div>
            )}
            <div data-testid="shared-media-secondary-controls" className="flex w-full flex-wrap items-center justify-center gap-2 md:contents">
              {visibleQualityOptions.length > 0 && (
                <label className="flex h-11 min-w-24 flex-1 items-center justify-center gap-1 rounded-xl bg-white/5 px-2 hover:bg-white/15 md:min-w-0 md:flex-none md:bg-transparent">
                  <Gauge size={18} aria-hidden />
                  <span className="sr-only">{t("sharedMedia.quality", "کیفیت ویدئو")}</span>
                  <select
                    value={selectedQuality}
                    onChange={(event) => {
                      const height = Number(event.currentTarget.value);
                      setSelectedQuality(height);
                      const hls = hlsRef.current;
                      if (!hls) return;
                      if (height === -1) {
                        hls.nextLevel = -1;
                        return;
                      }
                      let matchingLevel = -1;
                      hls.levels.forEach((level, index) => {
                        if (level.height === height) matchingLevel = index;
                      });
                      if (matchingLevel >= 0) hls.nextLevel = matchingLevel;
                    }}
                    className="min-w-0 max-w-24 bg-transparent text-xs text-white outline-none [&>option]:bg-slate-950"
                    aria-label={t("sharedMedia.quality", "کیفیت ویدئو")}
                  >
                    <option value={-1}>{t("sharedMedia.qualityAuto", "خودکار")}</option>
                    {visibleQualityOptions.map((option) => (
                      <option key={option.height || option.label} value={option.height}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {canModerate && (
                <label
                  className="flex h-11 min-w-28 flex-1 items-center justify-center gap-1 rounded-xl bg-white/5 px-2 hover:bg-white/15 md:min-w-0 md:flex-none md:bg-transparent"
                  title={playback.sync_policy === "strict"
                    ? t("sharedMedia.syncStrictHelp", "در صورت خارج‌شدن کاربران از سینک، پخش گروهی موقتاً متوقف می‌شود.")
                    : t("sharedMedia.syncContinuousHelp", "مشکل شبکه یک کاربر، پخش بقیه را متوقف نمی‌کند.")}
                >
                  <ShieldCheck size={18} aria-hidden />
                  <span className="sr-only">{t("sharedMedia.syncPolicy", "سیاست همگامی")}</span>
                  <select
                    value={playback.sync_policy}
                    disabled={commandPending}
                    onChange={(event) => void sendCommand("SET_SYNC_POLICY", 0, undefined, {
                      sync_policy: event.currentTarget.value as "continuous" | "strict",
                    })}
                    className="max-w-28 bg-transparent text-xs text-white outline-none disabled:opacity-60 [&>option]:bg-slate-950"
                    aria-label={t("sharedMedia.syncPolicy", "سیاست همگامی")}
                  >
                    <option value="continuous">{t("sharedMedia.syncContinuous", "پخش پیوسته")}</option>
                    <option value="strict">{t("sharedMedia.syncStrict", "سینک سخت‌گیرانه")}</option>
                  </select>
                </label>
              )}
              <div className="flex h-11 min-w-32 flex-1 items-center rounded-xl bg-white/5 px-1 md:min-w-0 md:flex-none md:bg-transparent md:px-0">
                <button type="button" onClick={() => {
                  if (volume === 0) {
                    setVolume(1);
                    setMuted(false);
                  } else {
                    setMuted((value) => !value);
                  }
                }} className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={muted || volume === 0 ? t("sharedMedia.unmute", "وصل کردن صدا") : t("sharedMedia.mute", "قطع صدا")}>
                  {muted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(volume * 100)}
                  onChange={(event) => {
                    const nextVolume = Number(event.currentTarget.value) / 100;
                    setVolume(nextVolume);
                    if (nextVolume > 0) setMuted(false);
                  }}
                  className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--brand)] md:w-20 md:flex-none"
                  aria-label={t("sharedMedia.volume", "صدای ویدئو")}
                />
              </div>
              <button
                type="button"
                onClick={() => setControlsPinned((pinned) => !pinned)}
                className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-xl bg-white/5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:bg-transparent"
                aria-pressed={controlsPinned}
                aria-label={controlsPinned
                  ? t("sharedMedia.unpinControls", "نمایش نوار روی ویدئو")
                  : t("sharedMedia.pinControls", "ثابت کردن نوار زیر ویدئو")}
                title={controlsPinned
                  ? t("sharedMedia.unpinControls", "نمایش نوار روی ویدئو")
                  : t("sharedMedia.pinControls", "ثابت کردن نوار زیر ویدئو")}
              >
                {controlsPinned ? <PinOff size={20} /> : <Pin size={20} />}
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-xl bg-white/5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:bg-transparent"
                aria-label={isFullscreen
                  ? t("sharedMedia.exitFullscreen", "خروج از تمام‌صفحه")
                  : t("sharedMedia.fullscreen", "تمام‌صفحه")}
                title={isFullscreen
                  ? t("sharedMedia.exitFullscreen", "خروج از تمام‌صفحه")
                  : t("sharedMedia.fullscreen", "تمام‌صفحه")}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
