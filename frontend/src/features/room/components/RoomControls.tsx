import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
} from "../hooks/useBackgroundBlur";
import SettingsPanel from "./SettingsPanel";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface RoomControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  sidebarTab: SidebarTab;
  settingsOpen: boolean;
  layout: LayoutMode;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleSidebar: (tab: SidebarTab) => void;
  onToggleSettings: () => void;
  onLayoutChange: (layout: LayoutMode) => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: () => void;
  onLeave: () => void;
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
  /** Button size token; defaults to md (tablet/desktop sizing). */
  size?: ControlButtonSize;
}

// ── Layout Popover ──
function LayoutPopover({
  layout,
  onChange,
  onClose,
}: {
  layout: LayoutMode;
  onChange: (l: LayoutMode) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("room");
  const layouts = [
    {
      id: "grid" as LayoutMode,
      icon: "⊞",
      label: t("layouts.grid"),
      desc: t("layouts.gridDesc"),
    },
    {
      id: "spotlight" as LayoutMode,
      icon: "□",
      label: t("layouts.spotlight"),
      desc: t("layouts.spotlightDesc"),
    },
    {
      id: "sidebar" as LayoutMode,
      icon: "▤",
      label: t("layouts.sidebar"),
      desc: t("layouts.sidebarDesc"),
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-52 fade-in">
        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2 px-1">
          {t("layouts.title")}
        </div>
        {layouts.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              onChange(l.id);
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg border-none cursor-pointer transition-all duration-150 text-left",
              layout === l.id
                ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
            )}
          >
            <span className="text-lg w-6 text-center">{l.icon}</span>
            <div>
              <div className="text-xs font-semibold">{l.label}</div>
              <div className="text-[10px] text-[var(--t3)]">{l.desc}</div>
            </div>
            {layout === l.id && (
              <span className="ml-auto text-[var(--brand)] text-xs">✓</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
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
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  isOn?: boolean;
  isOff?: boolean;
  size?: ControlButtonSize;
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
    />
  );
}

// ── Split Button (mic/cam with settings arrow) ──
function SplitBtn({
  iconOn,
  iconOff,
  label,
  tooltipMain,
  tooltipArrow,
  onMain,
  onArrow,
  isOn,
  popover,
}: {
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  label: string;
  tooltipMain: string;
  tooltipArrow: string;
  onMain: () => void;
  onArrow: () => void;
  isOn: boolean;
  popover?: React.ReactNode;
}) {
  const stateClass = isOn
    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
    : "bg-[var(--red)]/10 text-[var(--red)]";

  return (
    <div className="relative flex h-[52px]">
      <Tooltip content={tooltipMain}>
        <button
          onClick={onMain}
          className={cn(
            "flex flex-col items-center justify-center gap-1",
            "px-2.5 rounded-l-xl border-none cursor-pointer",
            "min-w-[40px] transition-all duration-150 active:scale-[0.96]",
            stateClass,
          )}
        >
          <span className="leading-none">{isOn ? iconOn : iconOff}</span>
          <span className="text-[9px] font-medium">{label}</span>
        </button>
      </Tooltip>
      <Tooltip content={tooltipArrow} side="top">
        <button
          onClick={onArrow}
          className={cn(
            "w-5 rounded-r-xl border-none border-l border-[var(--b)]",
            "cursor-pointer text-[10px] transition-all duration-150",
            "flex items-center justify-center",
            stateClass,
          )}
        >
          {Icons.chevronDown}
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
    if (!isMicOn) {
      setBars(Array(20).fill(4));
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
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
      if (animRef.current) cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isMicOn]);

  return (
    <div className="flex items-end gap-0.5 h-10 mb-3 px-1 bg-[var(--s3)] rounded-lg p-2">
      {bars.map((h, i) => (
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((d) => {
      setDevices(d);
      const input = d.find((x) => x.kind === "audioinput");
      const output = d.find((x) => x.kind === "audiooutput");
      if (input) setSelectedInput(input.deviceId);
      if (output) setSelectedOutput(output.deviceId);
    });
  }, []);

  const inputs = devices.filter((d) => d.kind === "audioinput");
  const outputs = devices.filter((d) => d.kind === "audiooutput");

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-[76px] left-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-64 fade-in">
        <div className="relative">
          <AudioVisualizer isMicOn={isMicOn} />
        </div>

        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
          {t("preJoin.microphone")}
        </div>
        <select
          value={selectedInput}
          onChange={(e) => setSelectedInput(e.target.value)}
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
          onChange={(e) => setSelectedOutput(e.target.value)}
          className="w-full bg-[var(--s3)] border border-[var(--b)] rounded-lg px-2 py-1.5 text-xs text-[var(--t1)] outline-none"
        >
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || t("preJoin.deviceLabels.speaker")}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

// ── Camera Settings Popover ──
function CamSettingsPopover({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("room");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const { background, isSupported, changeBackground } = useBackgroundBlur();

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((d) => {
      setDevices(d);
      const cam = d.find((x) => x.kind === "videoinput");
      if (cam) setSelectedCam(cam.deviceId);
    });
  }, []);

  const cameras = devices.filter((d) => d.kind === "videoinput");

  // Background labels are visual identifiers; reuse keys from preJoin
  const backgrounds: { id: BackgroundType; label: string; preview: string }[] =
    [
      { id: "none", label: t("preJoin.background"), preview: "" },
      { id: "blur", label: "Blur", preview: "" },
      {
        id: "office",
        label: "Office",
        preview:
          "https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&q=60",
      },
      {
        id: "nature",
        label: "Nature",
        preview:
          "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=120&q=60",
      },
      {
        id: "studio",
        label: "Studio",
        preview:
          "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=120&q=60",
      },
      {
        id: "minimal",
        label: "Minimal",
        preview:
          "https://images.unsplash.com/photo-1557683316-973673baf926?w=120&q=60",
      },
    ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-[76px] left-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-64 fade-in">
        {/* Camera device */}
        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
          {t("preJoin.camera")}
        </div>
        <select
          value={selectedCam}
          onChange={(e) => setSelectedCam(e.target.value)}
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
            {t("preJoin.bgNotSupported")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {backgrounds.map((bg) => (
              <Tooltip key={bg.id} content={bg.label}>
                <button
                  onClick={() => changeBackground(bg.id)}
                  className={cn(
                    "h-12 rounded-lg border-2 cursor-pointer transition-all overflow-hidden relative",
                    background === bg.id
                      ? "border-[var(--brand)] scale-105"
                      : "border-transparent hover:border-[var(--bh)]",
                  )}
                >
                  {bg.id === "none" ? (
                    <div className="w-full h-full bg-[var(--s3)] flex items-center justify-center text-[9px] text-[var(--t3)] font-semibold">
                      None
                    </div>
                  ) : bg.id === "blur" ? (
                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-[9px] text-white font-semibold backdrop-blur-sm">
                      Blur
                    </div>
                  ) : (
                    <img
                      src={bg.preview}
                      alt={bg.label}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {background === bg.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand)]/30">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main RoomControls ──
export default function RoomControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  sidebarTab,
  settingsOpen,
  layout,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleSidebar,
  onToggleSettings,
  onLayoutChange,
  isPushToTalk,
  onTogglePushToTalk,
  onLeave,
  activePanelOverride,
  onPanelButtonClick,
  size = "md",
}: RoomControlsProps) {
  const { t } = useTranslation("room");
  const [micPopoverOpen, setMicPopoverOpen] = useState(false);
  const [camPopoverOpen, setCamPopoverOpen] = useState(false);
  const [layoutPopoverOpen, setLayoutPopoverOpen] = useState(false);

  // When the parent provides a panel override (mobile shells), highlight
  // based on that. Otherwise fall back to the docked-panel sidebarTab.
  const isPanelActive = (panel: "people" | "chat" | "tools"): boolean => {
    if (activePanelOverride !== undefined) {
      return activePanelOverride === panel;
    }
    if (panel === "people") return sidebarTab === "participants";
    return sidebarTab === panel;
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

  // Ambient shell padding tightens on small sizes so the bar doesn't
  // overflow on a 320px viewport.
  const shellPadding =
    size === "sm" ? "px-2" : size === "md" ? "px-3" : "px-4";
  const shellHeight =
    size === "sm" ? "h-[64px]" : size === "md" ? "h-[68px]" : "h-[72px]";

  return (
    <div
      className={cn(
        "relative bg-[var(--s1)] border-t border-[var(--b)]",
        "flex items-center justify-between gap-2 flex-shrink-0",
        shellHeight,
        shellPadding,
      )}
    >
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={onToggleSettings}
        isPushToTalk={isPushToTalk}
        onTogglePushToTalk={onTogglePushToTalk}
      />
      {/* Left — mic, camera, screen share */}
      <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
        <SplitBtn
          iconOn={Icons.mic}
          iconOff={Icons.micOff}
          label={t("controls.mic")}
          tooltipMain={
            isMicOn ? t("tooltips.muteOn") : t("tooltips.muteOff")
          }
          tooltipArrow={t("tooltips.micSettings")}
          onMain={onToggleMic}
          onArrow={() => {
            setMicPopoverOpen((p) => !p);
            setCamPopoverOpen(false);
          }}
          isOn={isMicOn}
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
          tooltipMain={
            isCamOn ? t("tooltips.cameraOn") : t("tooltips.cameraOff")
          }
          tooltipArrow={t("tooltips.camSettings")}
          onMain={onToggleCam}
          onArrow={() => {
            setCamPopoverOpen((p) => !p);
            setMicPopoverOpen(false);
          }}
          isOn={isCamOn}
          popover={
            camPopoverOpen && (
              <CamSettingsPopover onClose={() => setCamPopoverOpen(false)} />
            )
          }
        />
        <CtrlBtn
          icon={Icons.screenShare}
          label={t("controls.share")}
          tooltip={t("tooltips.screenShare")}
          onClick={onToggleScreenShare}
          isOn={isScreenSharing}
          size={size}
        />
      </div>

      {/* Center */}
      <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
        <CtrlBtn
          icon={Icons.people}
          label={t("controls.people")}
          tooltip={t("tooltips.participants")}
          onClick={() => handlePanelClick("people")}
          isOn={isPanelActive("people")}
          size={size}
        />
        <CtrlBtn
          icon={Icons.chat}
          label={t("controls.chat")}
          tooltip={t("tooltips.chat")}
          onClick={() => handlePanelClick("chat")}
          isOn={isPanelActive("chat")}
          size={size}
        />
        <CtrlBtn
          icon={Icons.tools}
          label={t("controls.tools")}
          tooltip={t("tooltips.tools")}
          onClick={() => handlePanelClick("tools")}
          isOn={isPanelActive("tools")}
          size={size}
        />
        <div className="hidden md:block w-px h-7 bg-[var(--b)] mx-1" />

        {/* Layout button */}
        <div className="relative">
          <CtrlBtn
            icon={
              <span className="text-sm">
                {layout === "grid" ? "⊞" : layout === "spotlight" ? "□" : "▤"}
              </span>
            }
            label={t("controls.layout")}
            tooltip={t("tooltips.layout")}
            onClick={() => {
              setLayoutPopoverOpen((p) => !p);
            }}
            isOn={layoutPopoverOpen}
            size={size}
          />
          {layoutPopoverOpen && (
            <LayoutPopover
              layout={layout}
              onChange={onLayoutChange}
              onClose={() => setLayoutPopoverOpen(false)}
            />
          )}
        </div>

        <CtrlBtn
          icon={Icons.settings}
          label={t("controls.settings")}
          tooltip={t("tooltips.settings")}
          onClick={onToggleSettings}
          isOn={settingsOpen}
          size={size}
        />
      </div>

      {/* Right — leave (refreshed: solid rose with a subtle divider). */}
      <div className="flex items-center gap-2">
        <div className="hidden md:block w-px h-7 bg-[var(--b)]" />
        <ControlButton
          icon={Icons.leave}
          label={t("controls.leave")}
          tooltip={t("tooltips.leave")}
          onClick={onLeave}
          variant="leave"
          size={size}
        />
      </div>
    </div>
  );
}
