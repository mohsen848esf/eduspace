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

import { Switch } from "../../../components/ui";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: () => void;
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

  const {
    isHost,
    isCoHost,
    roomCode,
    requireApproval,
    isLocked,
    muteMicOnJoin,
    muteCamOnJoin,
    lockScreenShare,
    lockMicrophone,
    lockCamera,
    lockDocumentPresentation,
    setRoomSettings,
  } = useRoomStore();
  const canModerate = isHost || isCoHost;

  const handleToggleApproval = async () => {
    if (!roomCode || !canModerate || isUpdatingSettings) return;
    setIsUpdatingSettings(true);
    try {
      const next = !requireApproval;
      await roomApi.updateSettings(roomCode, { require_approval: next });
      setRoomSettings({ requireApproval: next });
    } catch {
      // Swallowed
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleToggleLock = async () => {
    if (!roomCode || !canModerate || isUpdatingSettings) return;
    setIsUpdatingSettings(true);
    try {
      const next = !isLocked;
      await roomApi.updateSettings(roomCode, { is_locked: next });
      setRoomSettings({ isLocked: next });
    } catch {
      // Swallowed
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleToggleSetting = async (
    key:
      | "mute_mic_on_join"
      | "mute_cam_on_join"
      | "lock_screen_share"
      | "lock_microphone"
      | "lock_camera"
      | "lock_document_presentation",
    val: boolean,
  ) => {
    if (!roomCode || !canModerate || isUpdatingSettings) return;
    setIsUpdatingSettings(true);
    try {
      await roomApi.updateSettings(roomCode, { [key]: val });
      if (key === "mute_mic_on_join") setRoomSettings({ muteMicOnJoin: val });
      if (key === "mute_cam_on_join") setRoomSettings({ muteCamOnJoin: val });
      if (key === "lock_screen_share") setRoomSettings({ lockScreenShare: val });
      if (key === "lock_microphone") setRoomSettings({ lockMicrophone: val });
      if (key === "lock_camera") setRoomSettings({ lockCamera: val });
      if (key === "lock_document_presentation") setRoomSettings({ lockDocumentPresentation: val });

      // Broadcast settings change to all in-call participants in real time
      if (room?.localParticipant) {
        const payload = {
          type: "ROOM_SETTINGS_CHANGED",
          settings: {
            muteMicOnJoin: key === "mute_mic_on_join" ? val : muteMicOnJoin,
            muteCamOnJoin: key === "mute_cam_on_join" ? val : muteCamOnJoin,
            lockScreenShare: key === "lock_screen_share" ? val : lockScreenShare,
            lockMicrophone: key === "lock_microphone" ? val : lockMicrophone,
            lockCamera: key === "lock_camera" ? val : lockCamera,
            lockDocumentPresentation:
              key === "lock_document_presentation" ? val : lockDocumentPresentation,
          },
        };
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));
        await room.localParticipant.publishData(data, { reliable: true });
      }
    } catch {
      // Swallowed
    } finally {
      setIsUpdatingSettings(false);
    }
  };

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
        "bg-[var(--s2)]/95 backdrop-blur-2xl border border-[var(--b)] rounded-3xl shadow-2xl p-5 text-[var(--t1)] animate-in fade-in zoom-in-95 duration-150 select-none",
      )}
      style={{
        boxShadow:
          "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 25px rgba(37,99,235,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--b)] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[var(--brand)]">{Icons.settings}</span>
          <span className="text-sm font-bold text-[var(--t1)]">
            {t("settings.title", "تنظیمات تماس")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--t3)] hover:text-[var(--t1)] text-xs p-1.5 rounded-lg hover:bg-[var(--s3)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
        >
          {Icons.x}
        </button>
      </div>

      {/* Modern Tabs Header */}
      <div className="flex gap-1.5 p-1 bg-[var(--s1)] rounded-2xl border border-[var(--b)] mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={cn(
            "flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5",
            activeTab === "devices"
              ? "bg-[var(--brand)] text-white shadow-sm font-bold"
              : "bg-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)]",
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
              ? "bg-[var(--brand)] text-white shadow-sm font-bold"
              : "bg-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)]",
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
              ? "bg-[var(--brand)] text-white shadow-sm font-bold"
              : "bg-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)]",
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
              ? "bg-[var(--brand)] text-white shadow-sm font-bold"
              : "bg-transparent text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)]",
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
            <label className="text-[11px] font-bold text-[var(--t3)] block mb-1.5 flex items-center gap-1.5">
              <span>{Icons.mic}</span>
              <span>{t("preJoin.microphone", "میکروفون")}</span>
            </label>
            <select
              value={selectedMic}
              onChange={(e) => handleDeviceChange("audioinput", e.target.value)}
              className="w-full bg-[var(--s1)] border border-[var(--b)] rounded-xl px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] transition-colors"
            >
              {mics.map((d) => (
                <option
                  key={d.deviceId}
                  value={d.deviceId}
                  className="bg-[var(--s2)] text-[var(--t1)]"
                >
                  {d.label || t("preJoin.deviceLabels.microphone", "میکروفون")}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div>
            <label className="text-[11px] font-bold text-[var(--t3)] block mb-1.5 flex items-center gap-1.5">
              <span>{Icons.camera}</span>
              <span>{t("preJoin.camera", "دوربین")}</span>
            </label>
            <select
              value={selectedCam}
              onChange={(e) => handleDeviceChange("videoinput", e.target.value)}
              className="w-full bg-[var(--s1)] border border-[var(--b)] rounded-xl px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] transition-colors"
            >
              {cameras.map((d) => (
                <option
                  key={d.deviceId}
                  value={d.deviceId}
                  className="bg-[var(--s2)] text-[var(--t1)]"
                >
                  {d.label || t("preJoin.deviceLabels.camera", "دوربین")}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker */}
          {speakers.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-[var(--t3)] block mb-1.5 flex items-center gap-1.5">
                <span>{Icons.bell}</span>
                <span>{t("preJoin.speaker", "بلندگو / اسپیکر")}</span>
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) =>
                  handleDeviceChange("audiooutput", e.target.value)
                }
                className="w-full bg-[var(--s1)] border border-[var(--b)] rounded-xl px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] transition-colors"
              >
                {speakers.map((d) => (
                  <option
                    key={d.deviceId}
                    value={d.deviceId}
                    className="bg-[var(--s2)] text-[var(--t1)]"
                  >
                    {d.label || t("preJoin.deviceLabels.speaker", "اسپیکر")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Virtual Background */}
          <div className="pt-1">
            <label className="text-[11px] font-bold text-[var(--t3)] block mb-2 flex items-center gap-1.5">
              <span>{Icons.eye}</span>
              <span>{t("preJoin.background", "افکت پس‌زمینه و بلور")}</span>
            </label>
            {!isSupported ? (
              <p className="text-[11px] text-[var(--t3)]">
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
                      "h-14 rounded-xl border-2 cursor-pointer transition-all overflow-hidden relative bg-[var(--s1)] p-0",
                      background === bg.id
                        ? "border-[var(--brand)] scale-[1.03] shadow-md shadow-[var(--brand)]/20"
                        : "border-transparent hover:border-[var(--b)]",
                    )}
                  >
                    {bg.id === "none" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-[var(--t2)] font-medium leading-none gap-1">
                        <span className="text-sm">Ø</span>
                        <span>{t("preJoin.bgNone", "هیچ")}</span>
                      </div>
                    )}
                    {bg.id === "blur" && (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-[var(--t2)] font-medium leading-none gap-1 bg-[var(--s3)]">
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
                    ? "bg-[var(--brand)] text-white border-[var(--brand)] shadow-md shadow-[var(--brand)]/20 font-bold"
                    : "bg-[var(--s1)] text-[var(--t2)] border-[var(--b)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
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
            className="w-full py-2.5 rounded-2xl bg-[var(--s1)] hover:bg-[var(--s3)] text-[var(--brand)] text-xs font-semibold border border-[var(--b)] transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{Icons.settings}</span>
            <span>
              {t("layout.adjustViewAdvanced", "تنظیمات پیشرفته چیدمان")}
            </span>
          </button>
        </div>
      )}

      {/* Tab 3: Access Control & Policies (Host & Co-Host Settings) */}
      {activeTab === "access" && (
        <div className="space-y-3 text-xs">
          {/* Require Approval Toggle */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-[var(--brand)]">{Icons.shield}</span>
                <span>
                  {t(
                    "settings.requireApprovalTitle",
                    "نیاز به تأیید برای ورود با لینک",
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                {t(
                  "settings.requireApprovalDesc",
                  "افرادی که از طریق لینک دعوت متصل می‌شوند ابتدا در لابی منتظر می‌مانند تا توسط شما تأیید شوند.",
                )}
              </p>
            </div>
            <Switch
              checked={requireApproval}
              disabled={!canModerate || isUpdatingSettings}
              onChange={handleToggleApproval}
            />
          </div>

          {/* Lock Room Toggle */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-amber-500">{Icons.lock}</span>
                <span>{t("settings.lockRoomTitle", "قفل کردن جلسه")}</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                {t(
                  "settings.lockRoomDesc",
                  "ورود هرگونه شرکت‌کننده جدید را کاملاً مسدود می‌کند.",
                )}
              </p>
            </div>
            <Switch
              checked={isLocked}
              disabled={!canModerate || isUpdatingSettings}
              onChange={handleToggleLock}
            />
          </div>

          {/* Mute Mic On Join */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-rose-500">🔇</span>
                <span>قطع میکروفون در بدو ورود</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                میکروفون شرکت‌کنندگان هنگام ورود به اتاق به صورت خودکار بسته باشد.
              </p>
            </div>
            <Switch
              checked={muteMicOnJoin}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("mute_mic_on_join", !muteMicOnJoin)}
            />
          </div>

          {/* Mute Cam On Join */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-rose-500">📷</span>
                <span>قطع وب‌کم در بدو ورود</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                دوربین شرکت‌کنندگان هنگام ورود به اتاق به صورت خودکار خاموش باشد.
              </p>
            </div>
            <Switch
              checked={muteCamOnJoin}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("mute_cam_on_join", !muteCamOnJoin)}
            />
          </div>

          {/* Lock Screen Share */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-amber-500">🖥️</span>
                <span>قفل اشتراک صفحه برای اعضا</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                تنها با درخواست و اجازه برگزارکننده یا همیاران امکان‌پذیر باشد.
              </p>
            </div>
            <Switch
              checked={lockScreenShare}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("lock_screen_share", !lockScreenShare)}
            />
          </div>

          {/* Lock Microphone */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-amber-500">🎙️</span>
                <span>قفل صحبت کردن (میکروفون)</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                اعضا برای باز کردن میکروفون باید از برگزارکننده اجازه بگیرند.
              </p>
            </div>
            <Switch
              checked={lockMicrophone}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("lock_microphone", !lockMicrophone)}
            />
          </div>

          {/* Lock Camera */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-amber-500">📷</span>
                <span>قفل دوربین (وب‌کم)</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                اعضا برای روشن کردن دوربین باید از برگزارکننده اجازه بگیرند.
              </p>
            </div>
            <Switch
              checked={lockCamera}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("lock_camera", !lockCamera)}
            />
          </div>

          {/* Lock Document Presentation */}
          <div className="p-3.5 bg-[var(--s1)] rounded-2xl border border-[var(--b)] flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-[var(--t1)] flex items-center gap-2">
                <span className="text-amber-500">📑</span>
                <span>قفل اشتراک و ارائه فایل</span>
              </div>
              <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                بارگذاری و ارائه فایل و اسلاید برای اعضا تنها با اجازه میزبان انجام شود.
              </p>
            </div>
            <Switch
              checked={lockDocumentPresentation}
              disabled={!canModerate || isUpdatingSettings}
              onChange={() => handleToggleSetting("lock_document_presentation", !lockDocumentPresentation)}
            />
          </div>

          {!canModerate && (
            <p className="text-[11px] text-amber-600 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              {t(
                "settings.hostOnlyNotice",
                "تنظیمات دسترسی جلسه فقط توسط مدیر (میزبان) یا همیاران قابل تغییر است.",
              )}
            </p>
          )}
        </div>
      )}

      {/* Tab 4: General */}
      {activeTab === "general" && (
        <div className="space-y-2.5 text-xs">
          {/* Push to Talk */}
          <div className="flex items-center justify-between p-3 bg-[var(--s1)] rounded-2xl border border-[var(--b)]">
            <div className="space-y-0.5">
              <div className="font-bold text-[var(--t1)]">
                {t("settings.pushToTalk", "فشردن برای صحبت (Push to Talk)")}
              </div>
              <div className="text-[11px] text-[var(--t3)]">
                {isPushToTalk
                  ? t("settings.pttHold", "نگه‌داشتن Space برای ارسال صدا")
                  : t("settings.pttDisabled", "غیرفعال")}
              </div>
            </div>
            <Switch
              checked={isPushToTalk}
              onChange={onTogglePushToTalk}
            />
          </div>

          {/* Noise Cancellation */}
          <div className="flex items-center justify-between p-3 bg-[var(--s1)] rounded-2xl border border-[var(--b)]">
            <div className="space-y-0.5">
              <span className="font-bold text-[var(--t1)] block">
                {t("settings.noiseCancellation", "حذف نویز و اکوی صدا")}
              </span>
              <span className="text-[11px] text-[var(--t3)] block">
                {t(
                  "settings.noiseDesc",
                  "بهینه‌سازی کیفیت صوتی و فیلتر صدای محیط",
                )}
              </span>
            </div>
            <Switch checked={true} onChange={() => {}} />
          </div>

          {/* HD Video */}
          <div className="flex items-center justify-between p-3 bg-[var(--s1)] rounded-2xl border border-[var(--b)]">
            <div className="space-y-0.5">
              <span className="font-bold text-[var(--t1)] block">
                {t("settings.hdVideo", "کیفیت ویدیوی HD")}
              </span>
              <span className="text-[11px] text-[var(--t3)] block">
                {t("settings.hdDesc", "ارسال تصویر با وضوح بالا 720p/1080p")}
              </span>
            </div>
            <Switch checked={true} onChange={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}

