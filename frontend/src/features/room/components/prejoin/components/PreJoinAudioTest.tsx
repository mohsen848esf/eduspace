import React from "react";
import { useTranslation } from "react-i18next";
import { Volume2, Mic, MicOff, Play, CheckCircle2, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface PreJoinAudioTestProps {
  micEnabled: boolean;
  audioLevel: number; // 0 to 100
  audioBars: number[];
  onPlayTestSound: () => void;
  isPlayingTestSound: boolean;
}

export const PreJoinAudioTest: React.FC<PreJoinAudioTestProps> = ({
  micEnabled,
  audioLevel,
  audioBars,
  onPlayTestSound,
  isPlayingTestSound,
}) => {
  const { t } = useTranslation("room");
  const isSpeaking = micEnabled && audioLevel > 15;
  const isClipping = audioLevel > 85;

  return (
    <div className="space-y-4">
      {/* 1. Speaker Diagnostic */}
      <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--t1)]">{t("preJoin.testSpeaker")}</div>
              <div className="text-[11px] text-[var(--t3)]">{t("preJoin.testSpeakerDesc")}</div>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={onPlayTestSound}
            disabled={isPlayingTestSound}
            className="flex items-center gap-1.5 font-bold cursor-pointer"
          >
            {isPlayingTestSound ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-ping" />
                <span>{t("preJoin.playing")}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{t("preJoin.playTestSound")}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Microphone Diagnostic */}
      <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                micEnabled
                  ? "bg-[var(--green)]/15 text-[var(--green)]"
                  : "bg-[var(--red)]/15 text-[var(--red)]"
              )}
            >
              {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--t1)]">{t("preJoin.testMic")}</div>
              <div className="text-[11px] text-[var(--t3)]">
                {micEnabled ? t("preJoin.testMicDesc") : t("preJoin.testMicOffDesc")}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {micEnabled && (
            <div
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1",
                isSpeaking
                  ? "bg-[var(--green)]/15 text-[var(--green)]"
                  : "bg-[var(--s3)] text-[var(--t3)]"
              )}
            >
              {isSpeaking ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t("preJoin.soundActive")}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>{t("preJoin.soundSilence")}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Real-time Frequency Waveform */}
        <div className="h-6 bg-[var(--s1)] rounded-xl px-2 py-1 flex items-end gap-0.5 border border-[var(--b)]/60">
          {audioBars.map((barHeight, idx) => (
            <div
              key={idx}
              className={cn(
                "flex-1 rounded-xs transition-all duration-75",
                !micEnabled && "bg-[var(--t3)]/30",
                micEnabled && !isClipping && "bg-[var(--green)]",
                micEnabled && isClipping && "bg-[var(--amber)]"
              )}
              style={{ height: `${micEnabled ? barHeight : 4}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreJoinAudioTest;
