import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import toast from "react-hot-toast";

interface RoomTopbarProps {
  isRecording?: boolean;
}

function useDuration() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function RoomTopbar({ isRecording = false }: RoomTopbarProps) {
  const { t } = useTranslation("room");
  const { roomCode, roomName, isHost } = useRoomStore();
  const remoteParticipants = useParticipants();

  const { localParticipant } = useLocalParticipant();
  const totalParticipants = new Set([
    localParticipant.identity,
    ...remoteParticipants.map((p) => p.identity),
  ]).size;
  const duration = useDuration();
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/room/${roomCode}`,
    );
    toast.success(t("topbar.copiedToast"));

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantsLabel =
    totalParticipants === 1
      ? t("topbar.participantOne", { count: totalParticipants })
      : t("topbar.participantOther", { count: totalParticipants });

  return (
    <div className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-[var(--s1)] border-b border-[var(--b)]">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
          <span className="text-sm font-semibold text-[var(--t1)]">
            {roomName || t("topbar.defaultRoomName")}
          </span>
          {isHost && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
              {t("topbar.host")}
            </span>
          )}
        </div>

        <Tooltip content={copied ? t("topbar.copied") : t("topbar.copy")}>
          <button
            onClick={copyRoomCode}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg border-none cursor-pointer transition-all text-xs font-mono force-ltr",
              copied
                ? "bg-[var(--green)]/15 text-[var(--green)]"
                : "bg-[var(--s3)] text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s4)]",
            )}
          >
            {copied ? "✓" : Icons.copy}
            {roomCode}
          </button>
        </Tooltip>
      </div>

      {/* Center */}
      <div className="flex items-center gap-3">
        {isRecording && (
          <div className="flex items-center gap-1.5 text-[var(--red)] text-xs font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse" />
            {t("topbar.rec")}
          </div>
        )}
        <span className="text-sm font-mono text-[var(--green)] font-semibold force-ltr">
          {duration}
        </span>
        <span className="text-xs text-[var(--t3)]">{participantsLabel}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 relative">
        <Tooltip content={t("topbar.info")}>
          <button
            onClick={() => setShowInfo((p) => !p)}
            className={cn(
              "w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all text-sm",
              showInfo
                ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                : "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
            )}
          >
            ℹ️
          </button>
        </Tooltip>

        {showInfo && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowInfo(false)}
            />
            <div className="absolute top-10 end-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-56 fade-in">
              <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
                {t("topbar.infoTitle")}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--t3)]">
                    {t("topbar.infoName")}
                  </span>
                  <span className="text-sm font-semibold text-[var(--t1)]">
                    {roomName || roomCode || t("topbar.defaultRoomName")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--t3)]">
                    {t("topbar.infoCode")}
                  </span>
                  <span className="text-xs font-mono text-[var(--brand-text)] force-ltr">
                    {roomCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--t3)]">
                    {t("topbar.infoDuration")}
                  </span>
                  <span className="text-xs font-mono text-[var(--green)] force-ltr">
                    {duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--t3)]">
                    {t("topbar.infoParticipants")}
                  </span>
                  <span className="text-xs font-medium text-[var(--t1)]">
                    {totalParticipants}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--t3)]">
                    {t("topbar.infoYourRole")}
                  </span>
                  <span className="text-xs font-medium text-[var(--brand-text)]">
                    {isHost
                      ? t("topbar.roleHost")
                      : t("topbar.roleParticipant")}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
