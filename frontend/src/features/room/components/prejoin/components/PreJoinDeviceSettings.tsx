import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Camera,
  Mic,
  Sparkles,
  FlipHorizontal,
} from "lucide-react";
import { type BackgroundType } from "../../../hooks/useBackgroundBlur";
import PreJoinAudioTest from "./PreJoinAudioTest";
import PreJoinEffectsPicker from "./PreJoinEffectsPicker";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface PreJoinDeviceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  // Devices
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  selectedCam: string;
  selectedMic: string;
  selectedSpeaker: string;
  onSelectCam: (id: string) => void;
  onSelectMic: (id: string) => void;
  onSelectSpeaker: (id: string) => void;
  // Controls
  camEnabled: boolean;
  micEnabled: boolean;
  isMirrored: boolean;
  onToggleMirror: () => void;
  // Audio Diagnostic
  audioLevel: number;
  audioBars: number[];
  onPlayTestSound: () => void;
  isPlayingTestSound: boolean;
  // Backgrounds
  selectedBg: BackgroundType;
  onChangeBackground: (bg: BackgroundType) => void;
  bgLoading: boolean;
  bgSupported: boolean;
}

type TabType = "audio" | "video" | "effects";

export const PreJoinDeviceSettings: React.FC<PreJoinDeviceSettingsProps> = ({
  isOpen,
  onClose,
  cameras,
  microphones,
  speakers,
  selectedCam,
  selectedMic,
  selectedSpeaker,
  onSelectCam,
  onSelectMic,
  onSelectSpeaker,
  camEnabled,
  micEnabled,
  isMirrored,
  onToggleMirror,
  audioLevel,
  audioBars,
  onPlayTestSound,
  isPlayingTestSound,
  selectedBg,
  onChangeBackground,
  bgLoading,
  bgSupported,
}) => {
  const { t } = useTranslation("room");
  const [activeTab, setActiveTab] = useState<TabType>("audio");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[var(--s1)] border border-[var(--b)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--b)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--t1)]">{t("preJoin.deviceSettings")}</h3>
              <p className="text-xs text-[var(--t3)]">{t("preJoin.deviceSettingsDesc")}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s2)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--b)] bg-[var(--s0)] px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("audio")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
              activeTab === "audio"
                ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--s1)] rounded-t-xl"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            )}
          >
            <Mic className="w-4 h-4" />
            <span>{t("preJoin.tabAudio")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
              activeTab === "video"
                ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--s1)] rounded-t-xl"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            )}
          >
            <Camera className="w-4 h-4" />
            <span>{t("preJoin.tabCamera")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("effects")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
              activeTab === "effects"
                ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--s1)] rounded-t-xl"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t("preJoin.tabEffects")}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: AUDIO */}
          {activeTab === "audio" && (
            <div className="space-y-5">
              {/* Microphone Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--t1)] block">{t("preJoin.microphone")}</label>
                <select
                  value={selectedMic}
                  onChange={(e) => onSelectMic(e.target.value)}
                  disabled={!micEnabled}
                  className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `${t("preJoin.deviceLabels.microphone")} (${mic.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--t1)] block">{t("preJoin.speaker")}</label>
                <select
                  value={selectedSpeaker}
                  onChange={(e) => onSelectSpeaker(e.target.value)}
                  className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
                >
                  {speakers.map((spk) => (
                    <option key={spk.deviceId} value={spk.deviceId}>
                      {spk.label || `${t("preJoin.deviceLabels.speaker")} (${spk.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Audio Diagnostic Player & Meter */}
              <PreJoinAudioTest
                micEnabled={micEnabled}
                audioLevel={audioLevel}
                audioBars={audioBars}
                onPlayTestSound={onPlayTestSound}
                isPlayingTestSound={isPlayingTestSound}
              />
            </div>
          )}

          {/* TAB 2: VIDEO */}
          {activeTab === "video" && (
            <div className="space-y-5">
              {/* Camera Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--t1)] block">{t("preJoin.camera")}</label>
                <select
                  value={selectedCam}
                  onChange={(e) => onSelectCam(e.target.value)}
                  disabled={!camEnabled}
                  className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `${t("preJoin.deviceLabels.camera")} (${cam.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mirror Image Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--s3)] text-[var(--t2)] flex items-center justify-center">
                    <FlipHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--t1)]">{t("preJoin.mirrorVideo")}</div>
                    <div className="text-[11px] text-[var(--t3)]">{t("preJoin.mirrorVideoDesc")}</div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isMirrored ? "primary" : "secondary"}
                  onClick={onToggleMirror}
                >
                  {isMirrored ? t("preJoin.enabled") : t("preJoin.disabled")}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: EFFECTS */}
          {activeTab === "effects" && (
            <PreJoinEffectsPicker
              selectedBg={selectedBg}
              onChangeBackground={onChangeBackground}
              isLoading={bgLoading}
              isSupported={bgSupported}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--b)] bg-[var(--s1)] flex justify-end">
          <Button onClick={onClose} className="px-6 font-bold cursor-pointer">
            {t("preJoin.closeAndSave")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreJoinDeviceSettings;
