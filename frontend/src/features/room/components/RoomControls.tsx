import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoomContext } from "@livekit/components-react";
import {
  Circle,
  Info,
  Maximize2,
  MoreVertical,
  PanelRightOpen,
  Shield,
  UserPlus,
} from "lucide-react";
import { type SidebarTab } from "../hooks/useRoomControls";
import { Tooltip } from "../../../components/ui/Tooltip";
import ControlButton, {
  type ControlButtonSize,
} from "../../../components/ui/ControlButton";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import {
  useBackgroundBlur,
  type BackgroundType,
  BG_IMAGES,
} from "../hooks/useBackgroundBlur";
import ChatUnreadBadge from "./ChatUnreadBadge";
import SettingsPanel from "./SettingsPanel";
import { LobbyPanel } from "./LobbyPanel";
import { useLobbyHost } from "../hooks/useLobbyHost";
import { type LayoutMode } from "../store/roomLayoutStore";
import { useRoomStore } from "../store/roomStore";
import ReactionsPopover from "./reactions/ReactionsPopover";
import RecordControls from "../../recordings/components/room/RecordControls";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";
import InviteModal from "./InviteModal";

interface RoomControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  sidebarTab: SidebarTab;
  settingsOpen: boolean;
  layout?: LayoutMode;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleSidebar: (tab: SidebarTab) => void;
  onToggleSettings: () => void;
  onLayoutChange?: (layout: LayoutMode) => void;
  isPushToTalk?: boolean;
  onTogglePushToTalk?: () => void;
  onLeave: () => void;
  roomCode?: string;
  size?: ControlButtonSize;
  className?: string;
  showWhiteboard?: boolean;
  showGame?: boolean;
  showRecording?: boolean;
  onToggleWhiteboard?: () => void;
  onToggleGame?: () => void;
  onToggleRecording?: () => void;
  isRecording?: boolean;
  handRaised?: boolean;
  onToggleHandRaise?: () => void;
  onSendReaction?: (emoji: string) => void;
  onOpenGuestPassModal?: () => void;
  onOpenInviteModal?: () => void;
  /**
   * Optional override the active panel highlight. Used by mobile shells
   * that drive their own activePanel state instead of relying on
   * useRoomControls.sidebarTab.
   */
  activePanelOverride?: "video" | "people" | "chat" | "tools";
  /**
   * Optional handler called when one of the panel buttons is tapped.
   * When provided, replaces the default onToggleSidebar dispatch — mobile
   * shells use this to drive swipe-stage / bottom-sheet state.
   */
  onPanelButtonClick?: (panel: "people" | "chat" | "tools") => void;
}

// ── Ctrl Button ──
// Thin wrapper around ControlButton that keeps the existing inline call
// sites in this file readable while letting the shared visual definition
// live in components/ui/ControlButton.tsx.
function CtrlBtn({
  icon,
  label,
  tooltip,
  onClick,
  isOn,
  isOff,
  size = "md",
  hideLabel = true,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  isOn?: boolean;
  isOff?: boolean;
  size?: ControlButtonSize;
  hideLabel?: boolean;
}) {
  const variant = isOn ? "active" : isOff ? "danger" : "default";
  return (
    <ControlButton
      icon={icon}
      label={label}
      tooltip={tooltip}
      onClick={onClick}
      variant={variant}
      size={size}
      hideLabel={hideLabel}
    />
  );
}

const splitSizes = {
  sm: { height: "h-10", mainWidth: "min-w-[40px]", arrowWidth: "w-6" },
  md: { height: "h-11", mainWidth: "min-w-[44px]", arrowWidth: "w-7" },
  lg: { height: "h-12", mainWidth: "min-w-[48px]", arrowWidth: "w-8" },
};

const MUTED_AUDIO_BARS = Array<number>(20).fill(4);

// ── Split Button (mic/cam with modern rotating chevron) ──
function SplitBtn({
  iconOn,
  iconOff,
  label,
  tooltipMain,
  tooltipArrow,
  onMain,
  onArrow,
  isOn,
  isArrowOpen = false,
  popover,
  size = "md",
}: {
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  label?: string;
  tooltipMain: string;
  tooltipArrow: string;
  onMain: () => void;
  onArrow: () => void;
  isOn: boolean;
  isArrowOpen?: boolean;
  popover?: React.ReactNode;
  size?: ControlButtonSize;
}) {
  const { height, mainWidth, arrowWidth } = splitSizes[size];

  return (
    <div
      className={cn(
        "relative flex items-center border rounded-2xl transition-all duration-200 shadow-sm group",
        height,
        isOn
          ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-600 dark:text-rose-400"
      )}
    >
      <Tooltip content={tooltipMain}>
        <button
          type="button"
          aria-label={label}
          onClick={onMain}
          className={cn(
            "flex items-center justify-center h-full px-2.5 rounded-s-2xl border-none cursor-pointer text-base md:text-lg",
            "transition-all duration-150 active:scale-95 bg-transparent text-inherit",
            mainWidth
          )}
        >
          <span className="leading-none">{isOn ? iconOn : iconOff}</span>
        </button>
      </Tooltip>
      <span className="w-px h-5 bg-current/20" aria-hidden />
      <Tooltip content={tooltipArrow} side="top">
        <button
          type="button"
          onClick={onArrow}
          className={cn(
            "h-full border-none rounded-e-2xl cursor-pointer text-xs transition-all duration-200",
            "flex items-center justify-center bg-transparent text-inherit hover:bg-white/10 active:scale-95",
            arrowWidth
          )}
        >
          <span
            className={cn(
              "transform transition-transform duration-200 inline-flex items-center justify-center",
              isArrowOpen && "rotate-180"
            )}
          >
            {Icons.chevronDown}
          </span>
        </button>
      </Tooltip>
      {popover}
    </div>
  );
}

// ── Audio Visualizer ──
function AudioVisualizer({ isMicOn }: { isMicOn: boolean }) {
  const { t } = useTranslation("room");
  const [bars, setBars] = useState(Array(20).fill(10));
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    if (!isMicOn) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!active) return;
          analyser.getByteFrequencyData(data);
          const sliced = Array.from(data.slice(0, 20)).map((v) =>
            Math.max(4, (v / 255) * 100),
          );
          setBars(sliced);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});

    return () => {
      active = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isMicOn]);

  return (
    <div className="flex items-end gap-0.5 h-10 mb-3 px-1 bg-[var(--s3)] rounded-lg p-2">
      {(isMicOn ? bars : MUTED_AUDIO_BARS).map((h, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-all duration-75",
            isMicOn ? "bg-[var(--green)]" : "bg-[var(--t3)]",
          )}
          style={{ height: `${h}%` }}
        />
      ))}
      {!isMicOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-[var(--t3)]">
            {t("audioVisualizer.muted")}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Mic Settings Popover ──
function MicSettingsPopover({
  onClose,
  isMicOn,
}: {
  onClose: () => void;
  isMicOn: boolean;
}) {
  const { t } = useTranslation("room");
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

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
  }, [onClose]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((d) => {
      setDevices(d);
      
      const currentInput = room.getActiveDevice("audioinput");
      const currentOutput = room.getActiveDevice("audiooutput");
      
      if (currentInput) {
        setSelectedInput(currentInput);
      } else {
        const input = d.find((x) => x.kind === "audioinput");
        if (input) setSelectedInput(input.deviceId);
      }
      
      if (currentOutput) {
        setSelectedOutput(currentOutput);
      } else {
        const output = d.find((x) => x.kind === "audiooutput");
        if (output) setSelectedOutput(output.deviceId);
      }
    });
  }, [room]);

  const handleInputChange = async (deviceId: string) => {
    setSelectedInput(deviceId);
    try {
      await room.switchActiveDevice("audioinput", deviceId);
    } catch (err) {
      console.error("Failed to switch audio input device", err);
    }
  };

  const handleOutputChange = async (deviceId: string) => {
    setSelectedOutput(deviceId);
    try {
      await room.switchActiveDevice("audiooutput", deviceId);
    } catch (err) {
      console.error("Failed to switch audio output device", err);
    }
  };

  const inputs = devices.filter((d) => d.kind === "audioinput");
  const outputs = devices.filter((d) => d.kind === "audiooutput");

  return (
    <div ref={popoverRef} className="absolute bottom-[76px] left-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-64 fade-in">
      <div className="relative">
        <AudioVisualizer isMicOn={isMicOn} />
      </div>

      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
        {t("preJoin.microphone")}
      </div>
      <select
        value={selectedInput}
        onChange={(e) => handleInputChange(e.target.value)}
        className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg px-2 py-1.5 text-xs text-[var(--t1)] outline-none mb-3"
      >
        {inputs.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || t("preJoin.deviceLabels.microphone")}
          </option>
        ))}
      </select>

      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
        {t("preJoin.speaker")}
      </div>
      <select
        value={selectedOutput}
        onChange={(e) => handleOutputChange(e.target.value)}
        className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg px-2 py-1.5 text-xs text-[var(--t1)] outline-none"
      >
        {outputs.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || t("preJoin.deviceLabels.speaker")}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Camera Settings Popover ──
function CamSettingsPopover({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("room");
  const room = useRoomContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const { background, isSupported, changeBackground } = useBackgroundBlur();
  const popoverRef = useRef<HTMLDivElement>(null);

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
  }, [onClose]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((d) => {
      setDevices(d);
      
      const currentCam = room.getActiveDevice("videoinput");
      if (currentCam) {
        setSelectedCam(currentCam);
      } else {
        const cam = d.find((x) => x.kind === "videoinput");
        if (cam) setSelectedCam(cam.deviceId);
      }
    });
  }, [room]);

  const handleCamChange = async (deviceId: string) => {
    setSelectedCam(deviceId);
    try {
      await room.switchActiveDevice("videoinput", deviceId);
    } catch (err) {
      console.error("Failed to switch video input device", err);
    }
  };

  const cameras = devices.filter((d) => d.kind === "videoinput");

  // Background labels are visual identifiers; reuse keys from preJoin
  const backgrounds: { id: BackgroundType; label: string; preview: string }[] =
    [
      { id: "none", label: t("preJoin.background"), preview: "" },
      { id: "blur", label: "Blur", preview: "" },
      {
        id: "office",
        label: t("background.office"),
        preview: BG_IMAGES.office || "/backgrounds/office.jpg",
      },
      {
        id: "nature",
        label: t("background.nature"),
        preview: BG_IMAGES.nature || "/backgrounds/nature.jpg",
      },
      {
        id: "studio",
        label: t("background.studio"),
        preview: BG_IMAGES.studio || "/backgrounds/studio.jpg",
      },
      {
        id: "minimal",
        label: t("background.minimal"),
        preview: BG_IMAGES.minimal || "/backgrounds/minimal.jpg",
      },
    ];

  return (
    <div ref={popoverRef} className="absolute bottom-[76px] left-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-64 fade-in">
      {/* Camera device */}
      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
        {t("preJoin.camera")}
      </div>
      <select
        value={selectedCam}
        onChange={(e) => handleCamChange(e.target.value)}
        className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg px-2 py-1.5 text-xs text-[var(--t1)] outline-none mb-3"
      >
        {cameras.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || t("preJoin.deviceLabels.camera")}
          </option>
        ))}
      </select>

      {/* Background */}
      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
        {t("preJoin.background")}
      </div>

      {!isSupported ? (
        <p className="text-xs text-[var(--t3)] px-1">
          {t("preJoin.backgroundNotSupported")}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => changeBackground(bg.id)}
              className={cn(
                "h-12 rounded-lg border-2 cursor-pointer transition-all overflow-hidden relative bg-[var(--s3)] p-0",
                background === bg.id
                  ? "border-[var(--brand)] scale-105"
                  : "border-transparent hover:border-[var(--bh)]",
              )}
            >
              {bg.id === "none" && (
                <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-[var(--t2)] font-medium leading-none gap-0.5">
                  <span className="text-sm">Ø</span>
                  <span>{t("preJoin.bgNone")}</span>
                </div>
              )}
              {bg.id === "blur" && (
                <div className="w-full h-full flex flex-col items-center justify-center text-[8px] text-[var(--t2)] font-medium leading-none gap-0.5 bg-[var(--s4)]">
                  <span className="text-xs">░</span>
                  <span>{t("preJoin.bgBlur")}</span>
                </div>
              )}
              {bg.id !== "none" && bg.id !== "blur" && (
                <>
                  <img
                    src={bg.preview}
                    alt={bg.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
}

function useCurrentTime() {
  const { i18n } = useTranslation();
  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })
      );
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [i18n.language]);
  return timeStr;
}

// ── Main RoomControls ──
export default function RoomControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  sidebarTab,
  settingsOpen,
  roomCode,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleSidebar,
  onToggleSettings,
  isPushToTalk,
  onTogglePushToTalk,
  onLeave,
  onPanelButtonClick,
  size = "md",
  handRaised,
  onToggleHandRaise,
  onSendReaction,
}: RoomControlsProps) {
  const { t } = useTranslation("room");
  const [micPopoverOpen, setMicPopoverOpen] = useState(false);
  const [camPopoverOpen, setCamPopoverOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [recordMenuOpen, setRecordMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);


  const currentTime = useCurrentTime();
  const { roomCode: storeRoomCode, roomName, isHost, isCoHost, lockScreenShare, canShareScreen } = useRoomStore();
  const activeRoomCode = roomCode || storeRoomCode || "";
  const canModerate = isHost || isCoHost;
  // Non-moderators can only see screen share button if they have explicit permission
  const showScreenShare = canModerate || !lockScreenShare || canShareScreen || isScreenSharing;

  const [lobbyPanelOpen, setLobbyPanelOpen] = useState(false);
  const lobby = useLobbyHost({
    roomCode: activeRoomCode,
    canModerate: isHost || isCoHost,
  });
  const recording = useRoomRecording({ roomCode: activeRoomCode, isHost });

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };


  // Same idea for the click handler — let the parent intercept to drive
  // its own state machine; otherwise dispatch to the docked sidebar.
  const handlePanelClick = (panel: "people" | "chat" | "tools") => {
    if (onPanelButtonClick) {
      onPanelButtonClick(panel);
      return;
    }
    onToggleSidebar(panel === "people" ? "participants" : panel);
  };

  const shellHeight =
    size === "sm" ? "h-[64px]" : size === "md" ? "h-[70px]" : "h-[76px]";

  return (
    <div
      className={cn(
        "relative z-50 bg-[color-mix(in_srgb,var(--s1)_85%,transparent)] backdrop-blur-xl border-t border-[var(--b)]",
        "flex items-center justify-between gap-1.5 sm:gap-2 flex-shrink-0 shadow-2xl transition-all select-none px-2 sm:px-4 md:px-6",
        shellHeight,
      )}
    >
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={onToggleSettings}
        isPushToTalk={!!isPushToTalk}
        onTogglePushToTalk={onTogglePushToTalk || (() => {})}
      />
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {(recordMenuOpen || infoOpen) && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-transparent"
            aria-label={t("mobile.close")}
            onClick={() => { setRecordMenuOpen(false); setInfoOpen(false); }}
          />
          <div dir="auto" role="dialog" className="absolute bottom-[calc(100%+12px)] left-1/2 z-[60] w-[min(360px,calc(100vw-24px))] -translate-x-1/2 rounded-3xl border border-[var(--b)] bg-[var(--s2)] p-5 shadow-2xl">
            <button type="button" className="absolute end-3 top-2 h-9 w-9 text-xl text-[var(--t2)]" onClick={() => { setRecordMenuOpen(false); setInfoOpen(false); }} aria-label={t("mobile.close")}>×</button>
            {recordMenuOpen ? (
              <RecordControls
                placement="top"
                roomCode={activeRoomCode}
                canControl={recording.canControl}
                status={recording.status}
                isMutating={recording.isMutating}
                onStart={recording.start}
                onStop={recording.stop}
                onPause={recording.pause}
                onResume={recording.resume}
              />
            ) : (
              <div className="space-y-3 pe-8">
                <h2 className="font-semibold text-[var(--t1)]">{t("topbar.infoTitle")}</h2>
                <div className="flex justify-between gap-4 text-sm"><span className="text-[var(--t3)]">{t("topbar.infoName")}</span><span>{roomName || t("topbar.defaultRoomName")}</span></div>
                <div className="flex justify-between gap-4 text-sm"><span className="text-[var(--t3)]">{t("topbar.infoCode")}</span><span dir="ltr" className="font-mono text-[var(--brand)]">{activeRoomCode}</span></div>
                <button type="button" className="w-full rounded-xl bg-[var(--s3)] px-3 py-2 text-sm" onClick={() => void navigator.clipboard.writeText(window.location.href)}>{t("topbar.copy")}</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Section 1: Meeting Info (Time + Room Code) ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:min-w-[110px] md:min-w-[180px] text-xs font-medium text-[var(--t2)] flex-shrink">
        {currentTime && (
          <span className="font-semibold text-[var(--t1)] hidden md:inline-block force-ltr">
            {currentTime}
          </span>
        )}
      </div>

      {/* ── Section 2: Center Floating Media Dock ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 px-2 sm:px-3 py-1 bg-[var(--s2)]/70 backdrop-blur-md border border-[var(--b)] rounded-2xl shadow-xl flex-shrink-0">
        <SplitBtn
          iconOn={Icons.mic}
          iconOff={Icons.micOff}
          label={t("controls.mic")}
          tooltipMain={isMicOn ? t("tooltips.muteOn") : t("tooltips.muteOff")}
          tooltipArrow={t("tooltips.micSettings")}
          onMain={onToggleMic}
          onArrow={() => {
            setMicPopoverOpen((p) => !p);
            setCamPopoverOpen(false);
            setReactionsOpen(false);
          }}
          isOn={isMicOn}
          isArrowOpen={micPopoverOpen}
          size={size}
          popover={
            micPopoverOpen && (
              <MicSettingsPopover
                onClose={() => setMicPopoverOpen(false)}
                isMicOn={isMicOn}
              />
            )
          }
        />
        <SplitBtn
          iconOn={Icons.camera}
          iconOff={Icons.cameraOff}
          label={t("controls.camera")}
          tooltipMain={isCamOn ? t("tooltips.cameraOn") : t("tooltips.cameraOff")}
          tooltipArrow={t("tooltips.camSettings")}
          onMain={onToggleCam}
          onArrow={() => {
            setCamPopoverOpen((p) => !p);
            setMicPopoverOpen(false);
            setReactionsOpen(false);
          }}
          isOn={isCamOn}
          isArrowOpen={camPopoverOpen}
          size={size}
          popover={
            camPopoverOpen && (
              <CamSettingsPopover onClose={() => setCamPopoverOpen(false)} />
            )
          }
        />

        {showScreenShare && (
          <CtrlBtn
            icon={Icons.screenShare}
            label={t("controls.share")}
            tooltip={t("tooltips.screenShare")}
            onClick={onToggleScreenShare}
            isOn={isScreenSharing}
            size={size}
          />
        )}

        {/* Reactions Button with Floating Emojis Popover */}
        <div className="relative" data-room-popup="reactions">
          <ReactionsPopover
            isOpen={reactionsOpen}
            onClose={() => setReactionsOpen(false)}
            onSelectEmoji={(emoji) => {
              if (onSendReaction) onSendReaction(emoji);
            }}
          />
          <CtrlBtn
            icon={<span className="text-lg leading-none">😊</span>}
            label={t("controls.reactions", "واکنش")}
            tooltip={t("controls.reactions", "ارسال واکنش و ایموجی")}
            onClick={() => {
              setReactionsOpen((prev) => !prev);
              setMicPopoverOpen(false);
              setCamPopoverOpen(false);
            }}
            isOn={reactionsOpen}
            size={size}
          />
        </div>

        <CtrlBtn
          icon={handRaised ? Icons.handFilled : Icons.hand}
          label={handRaised ? t("controls.lowerHand") : t("controls.raiseHand")}
          tooltip={handRaised ? t("tooltips.lowerHand") : t("tooltips.raiseHand")}
          onClick={onToggleHandRaise || (() => {})}
          isOn={handRaised}
          size={size}
        />

        <div ref={moreRef} className="relative" data-room-popup="more">
          <CtrlBtn
            icon={<MoreVertical size={21} />}
            label={t("controls.more")}
            tooltip={t("controls.more")}
            onClick={() => {
              setMoreOpen((open) => !open);
              setMicPopoverOpen(false);
              setCamPopoverOpen(false);
              setReactionsOpen(false);
            }}
            isOn={moreOpen}
            size={size}
          />
          {moreOpen && (
            <div dir="auto" role="menu" className="absolute bottom-[calc(100%+14px)] end-0 z-50 w-72 overflow-hidden rounded-3xl border border-[var(--b)] bg-[color-mix(in_srgb,var(--s2)_97%,transparent)] p-3 shadow-2xl backdrop-blur-2xl">
              {[
                { label: t("controls.chat"), icon: <span className="relative">{Icons.chat}<ChatUnreadBadge /></span>, run: () => handlePanelClick("chat") },
                { label: t("controls.people"), icon: Icons.people, run: () => handlePanelClick("people") },
                { label: t("mobile.invite"), icon: <UserPlus size={20} />, run: () => setInviteOpen(true) },
                { label: t("controls.tools"), icon: Icons.tools, run: () => handlePanelClick("tools") },
                { label: t("tile.fullscreen"), icon: <Maximize2 size={20} />, run: () => void toggleFullscreen() },
                { label: t("controls.settings"), icon: Icons.settings, run: onToggleSettings },
                ...(canModerate ? [{ label: t("lobby.hostPanelTitle"), icon: <Shield size={20} />, run: () => setLobbyPanelOpen(true), badge: lobby.count }] : []),
                { label: t("controls.rec"), icon: <Circle size={20} className="text-[var(--red)]" />, run: () => setRecordMenuOpen(true), disabled: !recording.canControl },
                { label: t("topbar.info"), icon: <Info size={20} />, run: () => setInfoOpen(true) },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-start text-sm transition-colors hover:bg-[var(--s3)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => { setMoreOpen(false); action.run(); }}
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--s3)] text-[var(--t1)]">{action.icon}{Boolean(action.badge) && <span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-[var(--red)] px-1 text-[10px] text-white">{action.badge}</span>}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leave Session Button */}
        <Tooltip content={t("tooltips.leave")}>
          <button
            type="button"
            onClick={onLeave}
            className={cn(
              "px-4 flex items-center justify-center rounded-xl border-none cursor-pointer font-bold transition-all active:scale-[0.96] duration-150 shadow-md",
              size === "sm" ? "h-10 text-xs" : size === "md" ? "h-11 text-sm" : "h-12 text-sm",
              "bg-[var(--red)] hover:bg-[var(--red)]/90 text-white shadow-[var(--red)]/20"
            )}
          >
            {Icons.leave}
          </button>
        </Tooltip>
      </div>

      {/* ── Section 3: one sidebar toggle; tabs live inside the sidebar. ── */}
      <div className="flex items-center gap-2 min-w-[130px] md:min-w-[180px] justify-end">
        <CtrlBtn
          icon={<span className="relative"><PanelRightOpen size={21} /><ChatUnreadBadge /></span>}
          label={t("controls.sidebar")}
          tooltip={t("controls.sidebar")}
          onClick={() => onToggleSidebar(sidebarTab ?? "participants")}
          isOn={sidebarTab !== null}
          size={size}
        />
      </div>

      <LobbyPanel
        isOpen={lobbyPanelOpen}
        onClose={() => setLobbyPanelOpen(false)}
        requests={lobby.requests}
        admittingId={lobby.admittingId}
        denyingId={lobby.denyingId}
        isBatchAction={lobby.isBatchAction}
        onAdmit={lobby.admit}
        onDeny={lobby.deny}
        onAdmitAll={lobby.admitAll}
        onDenyAll={lobby.denyAll}
      />
    </div>
  );
}
