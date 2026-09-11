import React, { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  Settings,
  FlipHorizontal,
  Volume2,
  VideoOff as CameraOffIcon,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuthStore } from "@/features/auth/store/authStore";
import { type BackgroundType } from "../../../hooks/useBackgroundBlur";
import PreJoinEffectsPicker from "./PreJoinEffectsPicker";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { useOrientation } from "@/hooks/useOrientation";

export interface PreJoinPreviewProps {
  videoRefCallback: (el: HTMLVideoElement | null) => void;
  camEnabled: boolean;
  micEnabled: boolean;
  cameraError?: "busy" | "unavailable" | null;
  onToggleCam?: () => void;
  onToggleMic?: () => void;
  /** When true, mic button is disabled with a lock icon (host has locked mic for all) */
  isMicLocked?: boolean;
  /** When true, cam button is disabled with a lock icon (host has locked camera for all) */
  isCamLocked?: boolean;
  isMirrored: boolean;
  onToggleMirror: () => void;
  onOpenSettings: () => void;
  selectedBg: BackgroundType;
  onChangeBackground: (bg: BackgroundType) => void;
  bgLoading: boolean;
  bgSupported: boolean;
  isLoadingDevices: boolean;
  audioLevel: number;
  audioBars: number[];
  guestName?: string;
}

export const PreJoinPreview: React.FC<PreJoinPreviewProps> = ({
  videoRefCallback,
  camEnabled,
  micEnabled,
  cameraError,
  onToggleCam,
  onToggleMic,
  isMicLocked = false,
  isCamLocked = false,
  isMirrored,
  onToggleMirror,
  onOpenSettings,
  selectedBg,
  onChangeBackground,
  bgLoading,
  bgSupported,
  isLoadingDevices,
  audioLevel,
  audioBars,
  guestName = "",
}) => {
  const { t } = useTranslation("room");
  const { user } = useAuthStore();
  const [showEffectsFlyout, setShowEffectsFlyout] = useState(false);
  const isMobileViewport = useIsMobile();
  const orientation = useOrientation();
  const forcePortraitPreview = isMobileViewport && orientation === "portrait";
  const [videoAspectRatio, setVideoAspectRatio] = useState(() => {
    const isPortraitMobile =
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
      window.matchMedia?.("(orientation: portrait)").matches;
    return isPortraitMobile ? 9 / 16 : 16 / 9;
  });

  const isSpeaking = micEnabled && audioLevel > 15;
  const hasActiveEffect = selectedBg !== "none";
  const displayedAspectRatio = forcePortraitPreview ? 9 / 16 : videoAspectRatio;
  const isPortraitPreview = isMobileViewport && displayedAspectRatio < 1;

  const handleVideoDimensions = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (!isMobileViewport) return;
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth > 0 && videoHeight > 0) {
      const nextAspectRatio = Math.min(16 / 9, Math.max(9 / 16, videoWidth / videoHeight));
      setVideoAspectRatio((currentAspectRatio) =>
        Math.abs(currentAspectRatio - nextAspectRatio) < 0.01
          ? currentAspectRatio
          : nextAspectRatio,
      );
    }
  };

  const displayName =
    user?.full_name ||
    user?.username ||
    guestName.trim() ||
    t("preJoin.guestDefaultName");
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      data-testid="prejoin-preview"
      style={{
        aspectRatio: isMobileViewport ? displayedAspectRatio : undefined,
      }}
      className={cn(
        "relative mx-auto aspect-video bg-[var(--s2)] rounded-3xl overflow-hidden border border-[var(--b)] shadow-2xl flex items-center justify-center group transition-[width,aspect-ratio] duration-300",
        isPortraitPreview ? "w-[min(82vw,38dvh)] max-w-[22rem]" : "w-full",
      )}
    >
      {/* 1. Camera Active Feed */}
      {camEnabled ? (
              <>
          <video
            ref={videoRefCallback}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={handleVideoDimensions}
            onResize={handleVideoDimensions}
            style={{ objectFit: "cover", objectPosition: "center" }}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform duration-300",
              isMirrored ? "scale-x-[-1]" : "scale-x-100",
              // Hide the black video element when we have a camera error
              cameraError ? "opacity-0" : "opacity-100"
            )}
          />

          {/* Camera Error Overlay — shown when track couldn't be acquired */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--s3)] via-[var(--s2)] to-[var(--s1)] z-10 animate-in fade-in p-6">
              <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-[var(--red)]/15 flex items-center justify-center">
                  <CameraOffIcon className="w-8 h-8 text-[var(--red)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--t1)]">
                  {cameraError === "busy"
                    ? t("preJoin.cameraBusy")
                    : t("preJoin.cameraUnavailable") || t("preJoin.cameraBusy")}
                </p>
              </div>
            </div>
          )}

          {/* Loading Background Processor Spinner */}
          {bgLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs z-10 animate-in fade-in">
              <Spinner size="lg" />
              <span className="text-xs font-bold text-white mt-2 drop-shadow-md">
                {t("preJoin.processingBg")}
              </span>
            </div>
          )}

          {/* Device Initializing Spinner */}
          {isLoadingDevices && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--s2)] z-20">
              <Spinner size="lg" />
            </div>
          )}
        </>
      ) : (
        /* 2. Camera Off Avatar State */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--s3)] via-[var(--s2)] to-[var(--s1)] p-6 z-0">
          <div className="relative flex items-center justify-center">
            {/* Luminous Speaking Pulse Ring */}
            {isSpeaking && (
              <span className="absolute -inset-3 rounded-full bg-[var(--green)]/30 animate-ping duration-1000" />
            )}

            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl transition-all duration-300",
                "bg-gradient-to-tr from-[var(--brand)] to-[var(--cyan)]",
                isSpeaking && "ring-4 ring-[var(--green)] scale-105"
              )}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </div>

          <div className="mt-4 text-center max-w-xs px-2">
            <h4 className="text-sm font-bold text-[var(--t1)]">{displayName}</h4>
            {cameraError && (
              <p className="text-xs text-[var(--t3)] mt-0.5">
                {cameraError === "busy"
                  ? t("preJoin.cameraBusy")
                  : t("preJoin.cameraUnavailable") || t("preJoin.cameraBusy")}
              </p>
            )}
            {!cameraError && (
              <p className="text-xs text-[var(--t3)] mt-0.5">
                {t("preJoin.cameraOff")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. Audio Frequency Waveform (Bottom Start) */}
      <div className={cn(
        "absolute start-4 z-30 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 shadow-lg",
        isPortraitPreview ? "top-4" : "bottom-4",
      )}>
        <Volume2 className={cn("w-3.5 h-3.5", micEnabled ? "text-[var(--green)]" : "text-white/40")} />
        <div className="flex items-end gap-0.5 h-3.5 w-12">
          {audioBars.slice(0, 8).map((bar, idx) => (
            <div
              key={idx}
              className={cn(
                "flex-1 rounded-xs transition-all duration-75",
                micEnabled ? "bg-[var(--green)]" : "bg-white/30"
              )}
              style={{ height: `${micEnabled ? bar : 15}%` }}
            />
          ))}
        </div>
      </div>

      {/* 4. Mirror Indicator & Quick Toggle (Top End) */}
      <div className="absolute top-4 end-4 z-30 flex items-center gap-2">
        <Tooltip content={isMirrored ? t("preJoin.mirrorActive") : t("preJoin.mirrorNormal")}>
          <button
            type="button"
            onClick={onToggleMirror}
            className="p-2.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-105"
          >
            <FlipHorizontal className="w-4 h-4 text-white" />
          </button>
        </Tooltip>
      </div>

      {/* 5. Live Floating Effects Flyout Menu (Overlaid directly above toolbar) */}
      {showEffectsFlyout && (
        <div className={cn("absolute bottom-20 max-w-lg mx-auto z-40", isPortraitPreview ? "inset-x-2" : "inset-x-4")}>
          <PreJoinEffectsPicker
            selectedBg={selectedBg}
            onChangeBackground={onChangeBackground}
            isLoading={bgLoading}
            isSupported={bgSupported}
            isFloating={true}
            onClose={() => setShowEffectsFlyout(false)}
          />
        </div>
      )}

      {/* 6. Floating Glassmorphism Controls (Bottom Center) */}
      <div className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/70 backdrop-blur-xl py-2 rounded-2xl border border-white/20 shadow-2xl",
        isPortraitPreview ? "gap-1.5 px-2" : "gap-2.5 px-4",
      )}>
        {/* Mic Toggle */}
        <Tooltip content={
          isMicLocked
            ? "میکروفون توسط برگزارکننده قفل شده است"
            : micEnabled ? t("preJoin.muteMic") : t("preJoin.unmuteMic")
        }>
          <button
            type="button"
            onClick={isMicLocked ? undefined : onToggleMic}
            aria-disabled={isMicLocked}
            className={cn(
              "rounded-xl flex items-center justify-center transition-all",
              isPortraitPreview ? "w-10 h-10" : "w-11 h-11",
              isMicLocked
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : micEnabled
                  ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                  : "bg-[var(--red)] hover:bg-[var(--red)]/90 text-white shadow-lg shadow-[var(--red)]/40 cursor-pointer"
            )}
          >
            {isMicLocked ? (
              <Lock className="w-4 h-4 text-white/50" />
            ) : micEnabled ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white" />
            )}
          </button>
        </Tooltip>

        {/* Camera Toggle */}
        <Tooltip content={
          isCamLocked
            ? "دوربین توسط برگزارکننده قفل شده است"
            : camEnabled ? t("preJoin.turnOffCamera") : t("preJoin.turnOnCamera")
        }>
          <button
            type="button"
            onClick={isCamLocked ? undefined : onToggleCam}
            aria-disabled={isCamLocked}
            className={cn(
              "rounded-xl flex items-center justify-center transition-all",
              isPortraitPreview ? "w-10 h-10" : "w-11 h-11",
              isCamLocked
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : camEnabled
                  ? "bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                  : "bg-[var(--red)] hover:bg-[var(--red)]/90 text-white shadow-lg shadow-[var(--red)]/40 cursor-pointer"
            )}
          >
            {isCamLocked ? (
              <Lock className="w-4 h-4 text-white/50" />
            ) : camEnabled ? (
              <Video className="w-5 h-5 text-white" />
            ) : (
              <VideoOff className="w-5 h-5 text-white" />
            )}
          </button>
        </Tooltip>

        {/* Effects Popover Trigger */}
        <Tooltip content={t("preJoin.visualEffects")}>
          <button
            type="button"
            onClick={() => setShowEffectsFlyout((prev) => !prev)}
            className={cn(
              "rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
              isPortraitPreview ? "w-10 h-10" : "w-11 h-11",
              showEffectsFlyout || hasActiveEffect
                ? "bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/50 ring-2 ring-white/60"
                : "bg-white/15 hover:bg-white/25 text-white"
            )}
          >
            <Sparkles className="w-5 h-5 text-white" />
            {hasActiveEffect && (
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[var(--cyan)] shadow-xs" />
            )}
          </button>
        </Tooltip>

        {/* Device Settings Trigger */}
        <Tooltip content={t("preJoin.deviceSettings")}>
          <button
            type="button"
            onClick={onOpenSettings}
            className={cn(
              "rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer",
              isPortraitPreview ? "w-10 h-10" : "w-11 h-11",
            )}
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default PreJoinPreview;
