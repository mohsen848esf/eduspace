import React, { useState } from "react";
import {
  Users,
  Copy,
  Check,
  Radio,
  Tv,
  CheckCircle2,
  Video,
  Mic,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { RoomInfo } from "../../../schemas/room.schema";

export interface PreJoinMeetingInfoProps {
  roomName: string;
  roomCode: string;
  roomInfo: RoomInfo | null;
  onJoin: () => void;
  onPresent: () => void;
  onCancel: () => void;
  camEnabled: boolean;
  micEnabled: boolean;
}

export const PreJoinMeetingInfo: React.FC<PreJoinMeetingInfoProps> = ({
  roomName,
  roomCode,
  roomInfo,
  onJoin,
  onPresent,
  onCancel,
  camEnabled,
  micEnabled,
}) => {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/room/${roomCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = user?.full_name || user?.username || "کاربر";

  const participants = roomInfo?.participants || [];
  const participantCount = participants.length;

  return (
    <div className="flex flex-col justify-between h-full space-y-6 bg-[var(--s1)] border border-[var(--b)] rounded-3xl p-6 shadow-xl">
      {/* 1. Header Section */}
      <div className="space-y-4">
        {/* Title & Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="brand" dot>
              {roomInfo?.status === "active" ? "جلسه آنلاین فعال" : "آماده پیوستن"}
            </Badge>
            {roomInfo?.is_recorded && (
              <Badge variant="neutral" className="text-[var(--red)] border-[var(--red)]/30">
                <Radio className="w-3 h-3 me-1 text-[var(--red)] animate-pulse" />
                <span>ضبط خودکار فعال است</span>
              </Badge>
            )}
          </div>

          <h2 className="text-2xl font-black text-[var(--t1)] tracking-tight">
            {roomName || "جلسه آموزشی آنلاین"}
          </h2>
        </div>

        {/* Room Code & Copy Link Banner */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--s2)] border border-[var(--b)]">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--t3)]">کد اتاق:</span>
            <span className="font-mono font-bold text-sm text-[var(--brand-text)] bg-[var(--s0)] px-2.5 py-1 rounded-lg border border-[var(--b)]/80 tracking-wider">
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
                <span className="text-[var(--green)]">کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>کپی لینک دعوت</span>
              </>
            )}
          </button>
        </div>

        {/* Participant Presence Overview */}
        <div className="p-4 rounded-2xl bg-[var(--s0)] border border-[var(--b)]/60 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--t2)]">
            <Users className="w-4 h-4 text-[var(--brand)]" />
            <span>حاضرین در تماس</span>
          </div>

          {participantCount > 0 ? (
            <div className="flex items-center gap-3">
              {/* Overlapping Avatars */}
              <div className="flex -space-x-2 rtl:space-x-reverse overflow-hidden">
                {participants.slice(0, 4).map((p, idx) => (
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
                {participants[0].user__full_name || participants[0].user__username}
                {participantCount > 1 && (
                  <span> و {participantCount - 1} نفر دیگر در این جلسه هستند</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--t3)] leading-relaxed">
              هنوز کسی در جلسه نیست. شما اولین نفری هستید که وارد می‌شوید!
            </p>
          )}
        </div>

        {/* User Identity Confirmation */}
        <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--t3)]">
          <span>ورود به عنوان:</span>
          <span className="font-bold text-[var(--t1)]">{displayName}</span>
        </div>
      </div>

      {/* 2. Device Readiness Checklist */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--s2)] border border-[var(--b)] text-center">
        <div className="flex flex-col items-center gap-1">
          <Video className="w-4 h-4 text-[var(--t2)]" />
          <span className="text-[10px] font-semibold text-[var(--t2)]">
            {camEnabled ? "دوربین روشن" : "دوربین خاموش"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-[var(--b)]">
          <Mic className="w-4 h-4 text-[var(--t2)]" />
          <span className="text-[10px] font-semibold text-[var(--t2)]">
            {micEnabled ? "میکروفون فعال" : "میکروفون بی‌صدا"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-[var(--green)]" />
          <span className="text-[10px] font-semibold text-[var(--green)]">شبکه پایدار</span>
        </div>
      </div>

      {/* 3. Primary CTAs */}
      <div className="space-y-2.5 pt-2">
        <Button
          fullWidth
          size="lg"
          onClick={onJoin}
          className="font-extrabold text-base py-3.5 shadow-lg shadow-[var(--brand)]/25 flex items-center justify-center gap-2"
        >
          <span>ورود به جلسه</span>
          <span className="text-lg">→</span>
        </Button>

        <Button
          fullWidth
          variant="secondary"
          size="md"
          onClick={onPresent}
          className="font-bold flex items-center justify-center gap-2"
        >
          <Tv className="w-4 h-4 text-[var(--brand)]" />
          <span>اشتراک مستقیم صفحه</span>
        </Button>

        <Button
          fullWidth
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-[var(--t3)] hover:text-[var(--red)] font-medium"
        >
          انصراف و بازگشت به داشبورد
        </Button>
      </div>
    </div>
  );
};

export default PreJoinMeetingInfo;
