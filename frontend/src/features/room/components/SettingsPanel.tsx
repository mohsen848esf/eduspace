import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRoomContext } from "@livekit/components-react";
import { cn } from "../../../lib/utils";
import { Icons } from "../../../lib/constants/icons";
import { useRoomLayoutStore } from "../store/roomLayoutStore";
import { useRoomStore } from "../store/roomStore";
import { roomApi } from "../api/room.api";
import {
  useBackgroundBlur,
  type BackgroundType,
  BG_IMAGES,
} from "../hooks/useBackgroundBlur";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: () => void;
}

function Toggle({
  on,
  onClick,
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
        on ? "bg-indigo-600" : "bg-white/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 block shadow-sm",
          on ? "translate-x-5" : "translate-x-0.5",
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

  const { isHost, roomCode, requireApproval, isLocked, setRoomSettings } =
    useRoomStore();

  const [activeTab, setActiveTab] = useState<
    "devices" | "layout" | "access" | "general"
  >("devices");

  // Device selectors
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const { background, isSupported, changeBackground } = useBackgroundBlur();

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
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

  const handleDeviceChange = async (
    kind: MediaDeviceKind,
    deviceId: string,
  ) => {
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

  const handleToggleApproval = async () => {
    if (!roomCode || !isHost || isUpdatingSettings) return;
    const nextVal = !requireApproval;
    setIsUpdatingSettings(true);
    try {
      await roomApi.updateSettings(roomCode, { require_approval: nextVal });
      setRoomSettings({ requireApproval: nextVal });
    } catch (e) {
      console.error("Failed to update approval settings", e);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleToggleLock = async () => {
    if (!roomCode || !isHost || isUpdatingSettings) return;
    const nextVal = !isLocked;
    setIsUpdatingSettings(true);
    try {
      await roomApi.updateSettings(roomCode, { is_locked: nextVal });
      setRoomSettings({ isLocked: nextVal });
    } catch (e) {
      console.error("Failed to update lock settings", e);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  if (!isOpen) return null;

  const mics = devices.filter((d) => d.kind === "audioinput");
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const backgrounds: { id: BackgroundType; label: string; preview: string }[] =
    [
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
        "absolute bottom-[76px] left-1/2 -translate-x-1/2 z-[100] w-[460px] max-w-[calc(100vw-2rem)]",
        "bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl p-5 text-white animate-in fade-in zoom-in-95 duration-150 select-none",
      )}
      style={{
        boxShadow:
          "0 25px 50px -12px rgba(0,0,0,0.7), 0 0 25px rgba(99,102,241,0.25)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400">{Icons.settings}</span>
          <span className="text-sm font-bold text-gray-100">
            {t("settings.title", "تنظیمات تماس")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xs p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
        >
          {Icons.x}
        </button>
      </div>

      {/* Modern Tabs Header */}
      <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/10 mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={cn(
            "flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5",
            activeTab === "devices"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
          )}
        >
          <span className="scale-90">{Icons.mic}</span>
          <span>{t("preJoin.devices", "دستگاه‌ها")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("layout")}
          className={cn(
            "flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5",
            activeTab === "layout"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
          )}
        >
          <span className="scale-90">{Icons.home}</span>
          <span>{t("controls.layout", "چیدمان")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("access")}
          className={cn(
            "flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5",
            activeTab === "access"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
          )}
        >
          <span className="scale-90">{Icons.shield}</span>
          <span>{t("settings.accessTab", "دسترسی")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5",
            activeTab === "general"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
          )}
        >
          <span className="scale-90">{Icons.tools}</span>
          <span>{t("settings.general", "عمومی")}</span>
        </button>
      </div>

      {/* Tab 1: Audio & Video Devices */}
      {activeTab === "devices" && (
        <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1 scrollbar-none text-xs">
          {/* Microphone */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <span>{Icons.mic}</span>
              <span>{t("preJoin.microphone", "میکروفون")}</span>
            </label>
            <select
              value={selectedMic}
              onChange={(e) => handleDeviceChange("audioinput", e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-400 transition-colors"
            >
              {mics.map((d) => (
                <option
                  key={d.deviceId}
                  value={d.deviceId}
                  className="bg-slate-900 text-white"
                >
                  {d.label || t("preJoin.deviceLabels.microphone", "میکروفون")}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <span>{Icons.camera}</span>
              <span>{t("preJoin.camera", "دوربین")}</span>
            </label>
            <select
              value={selectedCam}
              onChange={(e) => handleDeviceChange("videoinput", e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-400 transition-colors"
            >
              {cameras.map((d) => (
                <option
                  key={d.deviceId}
                  value={d.deviceId}
                  className="bg-slate-900 text-white"
                >
                  {d.label || t("preJoin.deviceLabels.camera", "دوربین")}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker */}
          {speakers.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1.5 flex items-center gap-1.5">
                <span>{Icons.bell}</span>
                <span>{t("preJoin.speaker", "بلندگو / اسپیکر")}</span>
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) =>
                  handleDeviceChange("audiooutput", e.target.value)
                }
                className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-400 transition-colors"
              >
                {speakers.map((d) => (
                  <option
                    key={d.deviceId}
                    value={d.deviceId}
                    className="bg-slate-900 text-white"
                  >
                    {d.label || t("preJoin.deviceLabels.speaker", "اسپیکر")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Virtual Background */}
          <div className="pt-1">
            <label className="text-[11px] font-bold text-gray-400 block mb-2 flex items-center gap-1.5">
              <span>{Icons.eye}</span>
              <span>{t("preJoin.background", "افکت پس‌زمینه و بلور")}</span>
            </label>
            {!isSupported ? (
              <p className="text-[11px] text-gray-400">
                {t(
                  "preJoin.backgroundNotSupported",
                  "مرورگر شما از جلوه‌های پس‌زمینه پشتیبانی نمی‌کند",
                )}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => changeBackground(bg.id)}
                    className={cn(
                      "h-14 rounded-xl border-2 cursor-pointer transition-all overflow-hidden relative bg-white/10 p-0",
                      background === bg.id
                        ? "border-indigo-400 scale-[1.03] shadow-md shadow-indigo-500/30"
                        : "border-transparent hover:border-white/30",
                    )}
                  >
                    {bg.id === "none" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-300 font-medium leading-none gap-1">
                        <span className="text-sm">Ø</span>
                        <span>{t("preJoin.bgNone", "هیچ")}</span>
                      </div>
                    )}
                    {bg.id === "blur" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-300 font-medium leading-none gap-1 bg-white/15">
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
                          <span className="text-[9px] text-white font-medium">
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
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: "auto" as const,
                label: t("layout.auto", "خودکار"),
                icon: Icons.tools,
              },
              {
                id: "tiled" as const,
                label: t("layout.tiled", "شبکه‌ای"),
                icon: Icons.home,
              },
              {
                id: "spotlight" as const,
                label: t("layout.spotlight", "تمرکز"),
                icon: Icons.eye,
              },
              {
                id: "sidebar" as const,
                label: t("layout.sidebar", "کناری"),
                icon: Icons.more,
              },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setLayoutMode(mode.id)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-2xl border text-xs font-semibold cursor-pointer transition-all",
                  layoutMode === mode.id
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                    : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className="scale-90">{mode.icon}</span>
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
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-indigo-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{Icons.settings}</span>
            <span>
              {t("layout.adjustViewAdvanced", "تنظیمات پیشرفته چیدمان")}
            </span>
          </button>
        </div>
      )}

      {/* Tab 3: Access Control (Host Settings) */}
      {activeTab === "access" && (
        <div className="space-y-3 text-xs">
          {/* Require Approval Toggle */}
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-gray-100 flex items-center gap-2">
                <span className="text-indigo-400">{Icons.shield}</span>
                <span>
                  {t(
                    "settings.requireApprovalTitle",
                    "نیاز به تأیید برای ورود با لینک",
                  )}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {t(
                  "settings.requireApprovalDesc",
                  "افرادی که از طریق لینک دعوت متصل می‌شوند ابتدا در لابی منتظر می‌مانند تا توسط شما تأیید شوند.",
                )}
              </p>
            </div>
            <Toggle
              on={requireApproval}
              disabled={!isHost || isUpdatingSettings}
              onClick={handleToggleApproval}
            />
          </div>

          {/* Lock Room Toggle */}
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-gray-100 flex items-center gap-2">
                <span className="text-amber-400">{Icons.lock}</span>
                <span>{t("settings.lockRoomTitle", "قفل کردن جلسه")}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {t(
                  "settings.lockRoomDesc",
                  "ورود هرگونه شرکت‌کننده جدید را کاملاً مسدود می‌کند.",
                )}
              </p>
            </div>
            <Toggle
              on={isLocked}
              disabled={!isHost || isUpdatingSettings}
              onClick={handleToggleLock}
            />
          </div>

          {!isHost && (
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              {t(
                "settings.hostOnlyNotice",
                "تنظیمات دسترسی جلسه فقط توسط مدیر (هاست) قابل تغییر است.",
              )}
            </p>
          )}
        </div>
      )}

      {/* Tab 4: General */}
      {activeTab === "general" && (
        <div className="space-y-2.5 text-xs">
          {/* Push to Talk */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="space-y-0.5">
              <div className="font-bold text-gray-200">
                {t("settings.pushToTalk", "فشردن برای صحبت (Push to Talk)")}
              </div>
              <div className="text-[11px] text-gray-400">
                {isPushToTalk
                  ? t("settings.pttHold", "نگه‌داشتن Space برای ارسال صدا")
                  : t("settings.pttDisabled", "غیرفعال")}
              </div>
            </div>
            <Toggle on={isPushToTalk} onClick={onTogglePushToTalk} />
          </div>

          {/* Noise Cancellation */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="space-y-0.5">
              <span className="font-bold text-gray-200 block">
                {t("settings.noiseCancellation", "حذف نویز و اکوی صدا")}
              </span>
              <span className="text-[11px] text-gray-400 block">
                {t(
                  "settings.noiseDesc",
                  "بهینه‌سازی کیفیت صوتی و فیلتر صدای محیط",
                )}
              </span>
            </div>
            <Toggle on={true} onClick={() => {}} />
          </div>

          {/* HD Video */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="space-y-0.5">
              <span className="font-bold text-gray-200 block">
                {t("settings.hdVideo", "کیفیت ویدیوی HD")}
              </span>
              <span className="text-[11px] text-gray-400 block">
                {t("settings.hdDesc", "ارسال تصویر با وضوح بالا 720p/1080p")}
              </span>
            </div>
            <Toggle on={true} onClick={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}

