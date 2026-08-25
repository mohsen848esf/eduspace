import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users,
  Copy,
  Check,
  Radio,
  CheckCircle2,
  Video,
  Mic,
  ArrowRight,
  ArrowLeft,
  User as UserIcon,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useLocale } from "@/i18n/useLocale";
import type { RoomInfo } from "../../../schemas/room.schema";

export interface PreJoinMeetingInfoProps {
  roomCode: string;
  roomInfo: RoomInfo | null;
  onJoin: () => void;
  onCancel: () => void;
  camEnabled: boolean;
  micEnabled: boolean;
  guestName?: string;
  onGuestNameChange?: (name: string) => void;
}

export const PreJoinMeetingInfo: React.FC<PreJoinMeetingInfoProps> = ({
  roomCode,
  roomInfo,
  onJoin,
  onCancel,
  camEnabled,
  micEnabled,
  guestName = "",
  onGuestNameChange,
}) => {
  const { t } = useTranslation("room");
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const { user } = useAuthStore();
  const isAuthenticated = Boolean(user);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/room/${roomCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = isAuthenticated
    ? user?.full_name || user?.username || t("preJoin.joiningAs")
    : guestName.trim() || t("preJoin.guestDefaultName");

  // Filter out the current user to accurately show other participants already inside the call
  const otherParticipants = (roomInfo?.participants || []).filter((p) => {
    if (isAuthenticated) {
      return p.user__username !== user?.username;
    }
    return true;
  });
  const otherCount = otherParticipants.length;

  const isGuestNameValid = !isAuthenticated ? guestName.trim().length >= 2 : true;

  return (
    <div className="flex flex-col justify-between h-full space-y-6 bg-[var(--s1)] border border-[var(--b)] rounded-3xl p-6 shadow-xl">
      {/* 1. Header & Room Details Section */}
      <div className="space-y-4">
        {/* Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="brand" dot>
            {roomInfo?.status === "active"
              ? t("preJoin.roomActive")
              : t("preJoin.readyToJoin")}
          </Badge>

          {roomInfo?.is_recorded && (
            <Badge variant="neutral" className="text-[var(--red)] border-[var(--red)]/30">
              <Radio className="w-3 h-3 me-1 text-[var(--red)] animate-pulse" />
              <span>{t("preJoin.autoRecording")}</span>
            </Badge>
          )}

          {!isAuthenticated && (
            <Badge variant="neutral" className="bg-[var(--cyan)]/15 text-[var(--cyan)] border-[var(--cyan)]/30">
              <span>{t("preJoin.guestBadge")}</span>
            </Badge>
          )}
        </div>

        {/* Room Code & 1-Click Copy Link Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--s2)] border border-[var(--b)]">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--t3)]">{t("preJoin.roomCodeLabel")}</span>
            <span className="font-mono font-extrabold text-sm text-[var(--brand)] bg-[var(--s0)] px-2.5 py-1 rounded-lg border border-[var(--b)]/80 tracking-wider">
              {roomCode}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--s1)] hover:bg-[var(--s3)] border border-[var(--b)] text-xs font-bold text-[var(--t1)] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                <span className="text-[var(--green)]">{t("preJoin.copied")}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t("preJoin.copyInviteLink")}</span>
              </>
            )}
          </button>
        </div>

        {/* Participant Presence Overview */}
        <div className="p-4 rounded-2xl bg-[var(--s0)] border border-[var(--b)]/60 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--t2)]">
            <Users className="w-4 h-4 text-[var(--brand)]" />
            <span>{t("preJoin.participantsInCall")}</span>
          </div>

          {otherCount > 0 ? (
            <div className="flex items-center gap-3">
              {/* Overlapping Avatars */}
              <div className="flex -space-x-2 rtl:space-x-reverse overflow-hidden">
                {otherParticipants.slice(0, 4).map((p, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--brand)] text-white text-xs font-bold ring-2 ring-[var(--s0)]"
                    title={p.user__full_name || p.user__username}
                  >
                    {(p.user__full_name || p.user__username).charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>

              <div className="text-xs text-[var(--t2)] font-medium">
                {otherParticipants[0].user__full_name || otherParticipants[0].user__username}
                {otherCount > 1 && (
                  <span> {t("preJoin.andOthers", { count: otherCount - 1 })}</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--t3)] leading-relaxed">
              {t("preJoin.noParticipantsYet")}
            </p>
          )}
        </div>

        {/* Identity Section: User Confirmation OR Guest Name Input */}
        {isAuthenticated ? (
          <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--t3)] bg-[var(--s2)] rounded-xl border border-[var(--b)]/60">
            <span>{t("preJoin.joiningAs")}</span>
            <span className="font-bold text-[var(--t1)]">{displayName}</span>
          </div>
        ) : (
          <div className="space-y-1.5 p-3.5 rounded-2xl bg-[var(--s2)] border border-[var(--b)]">
            <label className="text-xs font-bold text-[var(--t1)] flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>{t("preJoin.guestNameLabel")}</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => onGuestNameChange?.(e.target.value)}
              placeholder={t("preJoin.guestNamePlaceholder")}
              maxLength={50}
              className="w-full bg-[var(--s0)] border border-[var(--b)] focus:border-[var(--brand)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--t1)] outline-none transition-colors"
            />
            {guestName.trim().length > 0 && guestName.trim().length < 2 && (
              <span className="text-[10px] text-[var(--red)] font-medium block">
                {t("preJoin.guestNameMinLength")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Device Readiness Checklist */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--s2)] border border-[var(--b)] text-center">
        <div className="flex flex-col items-center gap-1">
          <Video className="w-4 h-4 text-[var(--t2)]" />
          <span className="text-[10px] font-semibold text-[var(--t2)]">
            {camEnabled ? t("preJoin.camOn") : t("preJoin.camOff")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-[var(--b)]">
          <Mic className="w-4 h-4 text-[var(--t2)]" />
          <span className="text-[10px] font-semibold text-[var(--t2)]">
            {micEnabled ? t("preJoin.micActive") : t("preJoin.micMuted")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-[var(--green)]" />
          <span className="text-[10px] font-semibold text-[var(--green)]">
            {t("preJoin.networkStable")}
          </span>
        </div>
      </div>

      {/* 3. Primary CTA & Semantic Back Link */}
      <div className="space-y-4 pt-2">
        <Button
          fullWidth
          size="lg"
          onClick={onJoin}
          disabled={!isGuestNameValid}
          className="font-extrabold text-base py-3.5 shadow-lg shadow-[var(--brand)]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{isAuthenticated ? t("preJoin.join") : t("preJoin.joinAsGuest")}</span>
          <span className="text-lg">→</span>
        </Button>

        {/* Semantic Link for Navigation */}
        <div className="flex items-center justify-center">
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--t3)] hover:text-[var(--brand)] transition-colors hover:underline"
          >
            {isFarsi ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>
              {isAuthenticated ? t("preJoin.backToDashboard") : t("preJoin.backToLogin")}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PreJoinMeetingInfo;
