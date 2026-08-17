import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRoomContext } from "@livekit/components-react";
import { cn } from "../../../lib/utils";
import { useBackgroundBlur, type BackgroundType, BG_IMAGES } from "../hooks/useBackgroundBlur";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-8 h-[18px] rounded-full relative transition-colors duration-200 border-none cursor-pointer flex-shrink-0",
        on ? "bg-[var(--brand)]" : "bg-[var(--s4)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 block",
          on ? "translate-x-[14px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export default function SettingsPanel({
  isOpen,
  onClose,
  isPushToTalk,
  onTogglePushToTalk,
}: SettingsPanelProps) {
  const { t } = useTranslation(["room", "common"]);
  const room = useRoomContext();
  const popoverRef = useRef<HTMLDivElement>(null);

  const layoutMode = useRoomLayoutStore((s) => s.layoutMode);
  const setLayoutMode = useRoomLayoutStore((s) => s.setLayoutMode);
  const setAdjustViewOpen = useRoomLayoutStore((s) => s.setAdjustViewOpen);

  const [activeTab, setActiveTab] = useState<"devices" | "layout" | "general">("devices");

  // Device selectors
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const { background, isSupported, changeBackground } = useBackgroundBlur();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices?.enumerateDevices().then((d) => {
      setDevices(d);
      if (room) {
        const curMic = room.getActiveDevice("audioinput");
        const curCam = room.getActiveDevice("videoinput");
        const curSpeaker = room.getActiveDevice("audiooutput");
        if (curMic) setSelectedMic(curMic);
        if (curCam) setSelectedCam(curCam);
        if (curSpeaker) setSelectedSpeaker(curSpeaker);
      }
    });
  }, [isOpen, room]);

  const handleDeviceChange = async (kind: MediaDeviceKind, deviceId: string) => {
    if (kind === "audioinput") {
      setSelectedMic(deviceId);
      try {
        await room?.switchActiveDevice("audioinput", deviceId);
      } catch (e) {
        console.error("Failed to switch mic", e);
      }
    } else if (kind === "videoinput") {
      setSelectedCam(deviceId);
      try {
        await room?.switchActiveDevice("videoinput", deviceId);
      } catch (e) {
        console.error("Failed to switch camera", e);
      }
    } else if (kind === "audiooutput") {
      setSelectedSpeaker(deviceId);
      try {
        await room?.switchActiveDevice("audiooutput", deviceId);
      } catch (e) {
        console.error("Failed to switch speaker", e);
      }
    }
  };

  if (!isOpen) return null;

  const mics = devices.filter((d) => d.kind === "audioinput");
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const backgrounds: { id: BackgroundType; label: string; preview: string }[] = [
    { id: "none", label: t("preJoin.bgNone", "بدون پس‌زمینه"), preview: "" },
    { id: "blur", label: t("preJoin.bgBlur", "مات / بلور"), preview: "" },
    {
      id: "office",
      label: "Office",
      preview: BG_IMAGES.office || "/backgrounds/office.jpg",
    },
    {
      id: "nature",
      label: "Nature",
      preview: BG_IMAGES.nature || "/backgrounds/nature.jpg",
    },
    {
      id: "studio",
      label: "Studio",
      preview: BG_IMAGES.studio || "/backgrounds/studio.jpg",
    },
    {
      id: "minimal",
      label: "Minimal",
      preview: BG_IMAGES.minimal || "/backgrounds/minimal.jpg",
    },
  ];

  return (
    <div
      ref={popoverRef}
      className={cn(
        "absolute bottom-[76px] left-1/2 -translate-x-1/2 z-[100] w-80 max-w-[calc(100vw-1.5rem)]",
        "bg-[#0f172a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-4 text-white animate-in fade-in zoom-in-95 duration-150 select-none",
      )}
      style={{
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7), 0 0 25px rgba(99,102,241,0.2)",
      }}
    >
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <span className="text-xs font-bold text-gray-200">
          ⚙️ {t("settings.title", "تنظیمات تماس")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xs p-1 rounded-md cursor-pointer border-none bg-transparent"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 mb-3 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={cn(
            "flex-1 py-1 rounded-lg transition-colors cursor-pointer border-none",
            activeTab === "devices"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-300 hover:text-white"
          )}
        >
          🎙️ {t("preJoin.devices", "صدا و تصویر")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("layout")}
          className={cn(
            "flex-1 py-1 rounded-lg transition-colors cursor-pointer border-none",
            activeTab === "layout"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-300 hover:text-white"
          )}
        >
          ▦ {t("controls.layout", "چیدمان")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex-1 py-1 rounded-lg transition-colors cursor-pointer border-none",
            activeTab === "general"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-300 hover:text-white"
          )}
        >
          ⚙️ {t("settings.general", "عمومی")}
        </button>
      </div>

      {/* Tab 1: Audio & Video Devices */}
      {activeTab === "devices" && (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-none">
          {/* Microphone */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              🎙️ {t("preJoin.microphone", "میکروفون")}
            </label>
            <select
              value={selectedMic}
              onChange={(e) => handleDeviceChange("audioinput", e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-indigo-400"
            >
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                  {d.label || t("preJoin.deviceLabels.microphone", "میکروفون")}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              📹 {t("preJoin.camera", "دوربین")}
            </label>
            <select
              value={selectedCam}
              onChange={(e) => handleDeviceChange("videoinput", e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-indigo-400"
            >
              {cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                  {d.label || t("preJoin.deviceLabels.camera", "دوربین")}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker */}
          {speakers.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                🔊 {t("preJoin.speaker", "بلندگو / اسپیکر")}
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) => handleDeviceChange("audiooutput", e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-indigo-400"
              >
                {speakers.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-slate-900 text-white">
                    {d.label || t("preJoin.deviceLabels.speaker", "اسپیکر")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Virtual Background */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              🖼️ {t("preJoin.background", "افکت پس‌زمینه و بلور")}
            </label>
            {!isSupported ? (
              <p className="text-[11px] text-gray-400">
                {t("preJoin.backgroundNotSupported", "مرورگر شما از جلوه‌های پس‌زمینه پشتیبانی نمی‌کند")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => changeBackground(bg.id)}
                    className={cn(
                      "h-12 rounded-lg border-2 cursor-pointer transition-all overflow-hidden relative bg-white/10 p-0",
                      background === bg.id
                        ? "border-indigo-400 scale-105 shadow-md shadow-indigo-500/30"
                        : "border-transparent hover:border-white/30"
                    )}
                  >
                    {bg.id === "none" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-gray-300 font-medium leading-none gap-0.5">
                        <span className="text-sm">Ø</span>
                        <span>{t("preJoin.bgNone", "هیچ")}</span>
                      </div>
                    )}
                    {bg.id === "blur" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-gray-300 font-medium leading-none gap-0.5 bg-white/15">
                        <span className="text-xs">░</span>
                        <span>{t("preJoin.bgBlur", "بلور")}</span>
                      </div>
                    )}
                    {bg.id !== "none" && bg.id !== "blur" && (
                      <>
                        <img
                          src={bg.preview}
                          alt={bg.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[8px] text-white font-medium">
                            {bg.label}
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Layout */}
      {activeTab === "layout" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: "auto" as const, label: t("layout.auto", "خودکار"), icon: "✦" },
              { id: "tiled" as const, label: t("layout.tiled", "شبکه‌ای"), icon: "▦" },
              { id: "spotlight" as const, label: t("layout.spotlight", "تمرکز"), icon: "□" },
              { id: "sidebar" as const, label: t("layout.sidebar", "کناری"), icon: "▤" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setLayoutMode(mode.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all",
                  layoutMode === mode.id
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                    : "bg-white/10 text-gray-300 border-white/10 hover:bg-white/15 hover:text-white"
                )}
              >
                <span className="text-sm leading-none">{mode.icon}</span>
                <span className="truncate">{mode.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              setAdjustViewOpen(true);
            }}
            className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-indigo-300 hover:text-indigo-200 text-xs font-semibold border border-white/15 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⚙️</span>
            <span>{t("layout.adjustViewAdvanced", "تنظیمات پیشرفته چیدمان")}</span>
          </button>
        </div>
      )}

      {/* Tab 3: General */}
      {activeTab === "general" && (
        <div className="space-y-2.5 text-xs">
          {/* Push to Talk */}
          <div className="flex items-center justify-between py-1.5 px-1 bg-white/5 rounded-lg border border-white/10">
            <div>
              <div className="font-semibold text-gray-200">
                {t("settings.pushToTalk", "فشردن برای صحبت")}
              </div>
              <div className="text-[10px] text-gray-400">
                {isPushToTalk
                  ? t("settings.pttHold", "نگه‌داشتن Space برای ارسال صدا")
                  : t("settings.pttDisabled", "غیرفعال")}
              </div>
            </div>
            <Toggle on={isPushToTalk} onClick={onTogglePushToTalk} />
          </div>

          {/* Noise Cancellation */}
          <div className="flex items-center justify-between py-1.5 px-1 bg-white/5 rounded-lg border border-white/10">
            <span className="font-semibold text-gray-200">
              {t("settings.noiseCancellation", "حذف نویز و اکوی صدا")}
            </span>
            <Toggle on={true} onClick={() => {}} />
          </div>

          {/* HD Video */}
          <div className="flex items-center justify-between py-1.5 px-1 bg-white/5 rounded-lg border border-white/10">
            <span className="font-semibold text-gray-200">
              {t("settings.hdVideo", "کیفیت ویدیوی HD")}
            </span>
            <Toggle on={true} onClick={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}
