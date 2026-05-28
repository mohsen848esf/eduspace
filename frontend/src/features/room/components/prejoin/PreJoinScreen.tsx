import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type BackgroundType } from "../../hooks/useBackgroundBlur";
import { Icons } from "../../../../lib/constants/icons";
import { Tooltip } from "../../../../components/ui/Tooltip";
import Button from "../../../../components/ui/Button";
import Spinner from "../../../../components/ui/Spinner";
import { cn } from "../../../../lib/utils";
import { usePreJoinTrack } from "../../hooks/usePreJoinTrack";

interface PreJoinScreenProps {
  roomName: string;
  roomCode: string;
  onJoin: (settings: PreJoinSettings) => void;
  onCancel: () => void;
}

export interface PreJoinSettings {
  micEnabled: boolean;
  camEnabled: boolean;
  selectedMic: string;
  selectedCam: string;
  selectedSpeaker: string;
  background: BackgroundType;
}

const BG_OPTIONS: {
  id: BackgroundType;
  labelKey: string;
  preview?: string;
  className?: string;
}[] = [
  { id: "none", labelKey: "preJoin.background", className: "bg-[var(--s3)]" },
  {
    id: "blur",
    labelKey: "preJoin.background",
    className: "bg-gradient-to-br from-gray-400 to-gray-600",
  },
  {
    id: "office",
    labelKey: "preJoin.background",
    preview:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&q=60",
  },
  {
    id: "nature",
    labelKey: "preJoin.background",
    preview:
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=120&q=60",
  },
  {
    id: "studio",
    labelKey: "preJoin.background",
    preview:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=120&q=60",
  },
  {
    id: "minimal",
    labelKey: "preJoin.background",
    preview:
      "https://images.unsplash.com/photo-1557683316-973673baf926?w=120&q=60",
  },
];

// ── Audio Level Meter ──
function AudioLevelMeter({
  micEnabled,
  selectedMic,
}: {
  micEnabled: boolean;
  selectedMic: string;
}) {
  const [bars, setBars] = useState(Array(24).fill(4));
  const animRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!micEnabled) {
      setBars(Array(24).fill(4));
      return;
    }
    const start = async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: selectedMic } : true,
        });
        streamRef.current = stream;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          setBars(
            Array.from(data.slice(0, 24)).map((v) =>
              Math.max(4, (v / 255) * 100),
            ),
          );
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* swallow */
      }
    };
    start();
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [micEnabled, selectedMic]);

  return (
    <div className="flex items-end gap-0.5 h-8 bg-[var(--s2)] rounded-lg px-2 py-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-all duration-75",
            micEnabled ? "bg-[var(--green)]" : "bg-[var(--t3)]",
          )}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export default function PreJoinScreen({
  roomName,
  roomCode,
  onJoin,
  onCancel,
}: PreJoinScreenProps) {
  const { t } = useTranslation("room");
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [activeTab, setActiveTab] = useState<"camera" | "audio">("camera");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const {
    background: selectedBg,
    isLoading: bgLoading,
    isSupported: bgSupported,
    attachToVideo,
    changeBackground,
  } = usePreJoinTrack();

  // Load devices
  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const d = await navigator.mediaDevices.enumerateDevices();
        setDevices(d);
        const mic = d.find((x) => x.kind === "audioinput");
        const cam = d.find((x) => x.kind === "videoinput");
        const speaker = d.find((x) => x.kind === "audiooutput");
        if (mic) setSelectedMic(mic.deviceId);
        if (cam) setSelectedCam(cam.deviceId);
        if (speaker) setSelectedSpeaker(speaker.deviceId);
      } catch {
        /* swallow */
      } finally {
        setIsLoadingDevices(false);
      }
    };
    load();
  }, []);

  // Camera preview with background
  useEffect(() => {
    if (!camEnabled || !selectedCam) {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    const start = async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCam },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        /* swallow */
      }
    };

    start();
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [camEnabled, selectedCam]);

  // Apply background to canvas
  useEffect(() => {
    if (!camEnabled || selectedBg === "none") {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (!video.videoWidth) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (selectedBg === "blur") {
        ctx.filter = "blur(12px)";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        const colors: Record<string, string> = {
          office: "#7c3f1e",
          nature: "#166534",
          studio: "#3730a3",
          minimal: "#334155",
        };
        ctx.fillStyle = colors[selectedBg] || "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      animRef.current = requestAnimationFrame(render);
    };

    cancelAnimationFrame(animRef.current);
    render();

    return () => cancelAnimationFrame(animRef.current);
  }, [selectedBg, camEnabled]);

  const mics = devices.filter((d) => d.kind === "audioinput");
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const handleJoin = () => {
    onJoin({
      micEnabled,
      camEnabled,
      selectedMic,
      selectedCam,
      selectedSpeaker,
      background: selectedBg,
    });
  };

  // Visual labels for backgrounds (these stay english because they map to the
  // image asset; the section header above translates).
  const bgVisualLabel: Record<BackgroundType, string> = {
    none: "None",
    blur: "Blur",
    office: "Office",
    nature: "Nature",
    studio: "Studio",
    minimal: "Minimal",
  };

  return (
    <div className="min-h-screen bg-[var(--s0)] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-[var(--t1)] mb-1">
            {roomName}
          </div>
          <div className="text-sm text-[var(--t3)]">
            {t("preJoin.roomCodeLabel")}{" "}
            <span className="font-mono text-[var(--brand-text)]">
              {roomCode}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left — Camera preview */}
          <div className="flex flex-col gap-3">
            <div className="relative bg-[var(--s2)] rounded-2xl overflow-hidden aspect-video">
              {camEnabled ? (
                <>
                  <video
                    ref={(el) => {
                      attachToVideo(el);
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                  {bgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                      <Spinner size="md" />
                    </div>
                  )}
                  {isLoadingDevices && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--s2)] z-20">
                      <Spinner size="lg" />
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-[var(--s3)] flex items-center justify-center text-[var(--t3)]">
                    {Icons.cameraOff}
                  </div>
                  <p className="text-sm text-[var(--t3)]">
                    {t("preJoin.cameraOff")}
                  </p>
                </div>
              )}

              {/* Mic/Cam toggles overlay */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                <Tooltip
                  content={
                    micEnabled ? t("preJoin.muteMic") : t("preJoin.unmuteMic")
                  }
                >
                  <button
                    onClick={() => setMicEnabled((p) => !p)}
                    className={cn(
                      "w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center transition-all",
                      micEnabled
                        ? "bg-[var(--s3)]/80 text-[var(--t1)] hover:bg-[var(--s4)]"
                        : "bg-[var(--red)]/80 text-white hover:bg-[var(--red)]",
                    )}
                  >
                    {micEnabled ? Icons.mic : Icons.micOff}
                  </button>
                </Tooltip>
                <Tooltip
                  content={
                    camEnabled
                      ? t("preJoin.turnOffCamera")
                      : t("preJoin.turnOnCamera")
                  }
                >
                  <button
                    onClick={() => setCamEnabled((p) => !p)}
                    className={cn(
                      "w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center transition-all",
                      camEnabled
                        ? "bg-[var(--s3)]/80 text-[var(--t1)] hover:bg-[var(--s4)]"
                        : "bg-[var(--red)]/80 text-white hover:bg-[var(--red)]",
                    )}
                  >
                    {camEnabled ? Icons.camera : Icons.cameraOff}
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Background selector */}
            <div>
              <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
                {t("preJoin.background")}
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {BG_OPTIONS.map((bg) => (
                  <Tooltip key={bg.id} content={bgVisualLabel[bg.id]}>
                    <button
                      onClick={() => changeBackground(bg.id)}
                      disabled={bgLoading || !bgSupported}
                      className={cn(
                        "h-10 rounded-lg border-2 cursor-pointer transition-all overflow-hidden relative",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                        selectedBg === bg.id
                          ? "border-[var(--brand)] scale-105"
                          : "border-transparent hover:border-[var(--bh)]",
                      )}
                    >
                      {bg.preview ? (
                        <img
                          src={bg.preview}
                          alt={bgVisualLabel[bg.id]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={cn("w-full h-full", bg.className)} />
                      )}
                      {selectedBg === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand)]/30">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  </Tooltip>
                ))}
              </div>
              {!bgSupported && (
                <p className="text-[10px] text-[var(--t3)] mt-1.5">
                  {t("preJoin.bgNotSupported")}
                </p>
              )}
              {bgLoading && (
                <p className="text-[10px] text-[var(--brand-text)] mt-1.5 animate-pulse">
                  {t("preJoin.bgApplying")}
                </p>
              )}
            </div>
          </div>

          {/* Right — Device settings */}
          <div className="bg-[var(--s1)] rounded-2xl border border-[var(--b)] p-4 flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--s2)] rounded-lg p-1 flex-shrink-0">
              {(["camera", "audio"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer transition-all",
                    activeTab === tab
                      ? "bg-[var(--s1)] text-[var(--t1)] shadow-sm"
                      : "bg-transparent text-[var(--t3)] hover:text-[var(--t1)]",
                  )}
                >
                  {tab === "camera"
                    ? t("preJoin.tabCamera")
                    : t("preJoin.tabAudio")}
                </button>
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ height: "200px", overflow: "hidden" }}
            >
              {/* Camera tab */}
              <div
                className={cn(
                  "flex flex-col gap-3",
                  activeTab !== "camera" && "hidden",
                )}
              >
                <div>
                  <label className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider block mb-1.5">
                    {t("preJoin.camera")}
                  </label>
                  <select
                    value={selectedCam}
                    onChange={(e) => setSelectedCam(e.target.value)}
                    disabled={!camEnabled}
                    className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-lg px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] disabled:opacity-50 transition-colors"
                  >
                    {cameras.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || t("preJoin.deviceLabels.camera")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audio tab */}
              <div
                className={cn(
                  "flex flex-col gap-3",
                  activeTab !== "audio" && "hidden",
                )}
              >
                <div>
                  <label className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider block mb-1.5">
                    {t("preJoin.microphone")}
                  </label>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    disabled={!micEnabled}
                    className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-lg px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] disabled:opacity-50 transition-colors"
                  >
                    {mics.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || t("preJoin.deviceLabels.microphone")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider block mb-1.5">
                    {t("preJoin.speaker")}
                  </label>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-lg px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--brand)] transition-colors"
                  >
                    {speakers.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || t("preJoin.deviceLabels.speaker")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider block mb-1.5">
                    {t("preJoin.micLevel")}
                  </label>
                  <AudioLevelMeter
                    micEnabled={micEnabled}
                    selectedMic={selectedMic}
                  />
                </div>
              </div>
            </div>

            {/* Join buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button fullWidth onClick={handleJoin}>
                {t("preJoin.join")}
              </Button>
              <Button variant="ghost" fullWidth onClick={onCancel}>
                {t("preJoin.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
