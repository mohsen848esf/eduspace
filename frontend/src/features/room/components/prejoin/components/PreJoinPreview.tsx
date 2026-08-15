import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  Settings,
  FlipHorizontal,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuthStore } from "@/features/auth/store/authStore";

export interface PreJoinPreviewProps {
  videoRefCallback: (el: HTMLVideoElement | null) => void;
  camEnabled: boolean;
  micEnabled: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  isMirrored: boolean;
  onToggleMirror: () => void;
  onOpenSettings: () => void;
  onOpenEffects: () => void;
  bgLoading: boolean;
  isLoadingDevices: boolean;
  audioLevel: number;
  audioBars: number[];
}

export const PreJoinPreview: React.FC<PreJoinPreviewProps> = ({
  videoRefCallback,
  camEnabled,
  micEnabled,
  onToggleCam,
  onToggleMic,
  isMirrored,
  onToggleMirror,
  onOpenSettings,
  onOpenEffects,
  bgLoading,
  isLoadingDevices,
  audioLevel,
  audioBars,
}) => {
  const { user } = useAuthStore();
  const isSpeaking = micEnabled && audioLevel > 15;

  const displayName = user?.full_name || user?.username || "کاربر";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative w-full aspect-video bg-[var(--s2)] rounded-3xl overflow-hidden border border-[var(--b)] shadow-2xl flex items-center justify-center group">
      {/* 1. Camera Active Feed */}
      {camEnabled ? (
        <>
          <video
            ref={videoRefCallback}
            autoPlay
            muted
            playsInline
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform duration-300",
              isMirrored ? "scale-x-[-1]" : "scale-x-100"
            )}
          />

          {/* Loading Background Processor Spinner */}
          {bgLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs z-10 animate-in fade-in">
              <Spinner size="lg" />
              <span className="text-xs font-bold text-white mt-2 drop-shadow-md">در حال پردازش پس‌زمینه...</span>
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

          <div className="mt-4 text-center">
            <h4 className="text-sm font-bold text-[var(--t1)]">{displayName}</h4>
            <p className="text-xs text-[var(--t3)] mt-0.5">دوربین شما خاموش است</p>
          </div>
        </div>
      )}

      {/* 3. Audio Frequency Waveform (Bottom Start) */}
      <div className="absolute bottom-4 start-4 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
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

      {/* 4. Mirror Indicator (Top End) */}
      <div className="absolute top-4 end-4 z-30 flex items-center gap-2">
        <Tooltip content={isMirrored ? "تصویر آینه‌ای فعال است" : "تصویر در حالت عادی است"}>
          <button
            type="button"
            onClick={onToggleMirror}
            className="p-2 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer shadow-md"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* 5. Floating Glassmorphism Controls (Bottom Center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-black/65 backdrop-blur-lg px-4 py-2 rounded-2xl border border-white/15 shadow-2xl">
        {/* Mic Toggle */}
        <Tooltip content={micEnabled ? "قطع میکروفون (Mute)" : "اتصال میکروفون (Unmute)"}>
          <button
            type="button"
            onClick={onToggleMic}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer",
              micEnabled
                ? "bg-white/15 hover:bg-white/25 text-white"
                : "bg-[var(--red)] hover:bg-[var(--red)]/90 text-white shadow-lg shadow-[var(--red)]/40"
            )}
          >
            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
        </Tooltip>

        {/* Camera Toggle */}
        <Tooltip content={camEnabled ? "خاموش کردن دوربین" : "روشن کردن دوربین"}>
          <button
            type="button"
            onClick={onToggleCam}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer",
              camEnabled
                ? "bg-white/15 hover:bg-white/25 text-white"
                : "bg-[var(--red)] hover:bg-[var(--red)]/90 text-white shadow-lg shadow-[var(--red)]/40"
            )}
          >
            {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </Tooltip>

        {/* Effects Picker Trigger */}
        <Tooltip content="جلوه‌های بصری و پس‌زمینه">
          <button
            type="button"
            onClick={onOpenEffects}
            className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-[var(--brand-soft)]" />
          </button>
        </Tooltip>

        {/* Device Settings Trigger */}
        <Tooltip content="تنظیمات صدا و تصویر">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default PreJoinPreview;
