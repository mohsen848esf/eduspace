import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import type { LobbyWaitingStatus } from "../hooks/useLobbyWaiting";

interface LobbyWaitingScreenProps {
  status: LobbyWaitingStatus | "locked";
  roomCode: string;
  roomName?: string;
  elapsedSeconds?: number;
  displayName?: string;
  onRetry?: () => void;
  onLeave?: () => void;
}

export const LobbyWaitingScreen: React.FC<LobbyWaitingScreenProps> = ({
  status,
  roomCode,
  roomName,
  elapsedSeconds = 0,
  displayName,
  onRetry,
  onLeave,
}) => {
  const { t } = useTranslation("room");
  const navigate = useNavigate();

  const handleExit = () => {
    if (onLeave) {
      onLeave();
    } else {
      navigate("/dashboard");
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen w-full bg-[var(--s0)] flex flex-col items-center justify-center p-4 text-[var(--t1)] relative overflow-hidden select-none font-sans">
      {/* Background ambient glowing gradient orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md bg-[var(--s1)] border border-[var(--b)] backdrop-blur-2xl rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Room Header Info */}
        <div className="mb-6 flex flex-col items-center">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 tracking-wide uppercase mb-2">
            {roomCode}
          </span>
          <h2 className="text-lg font-bold text-[var(--t1)] line-clamp-1">
            {roomName || t("lobby.defaultRoomTitle", "اتاق گفتگو")}
          </h2>
          {displayName && (
            <p className="text-xs text-[var(--t3)] mt-0.5">
              {t("lobby.asUser", "ورود به عنوان:")}{" "}
              <span className="text-[var(--t2)] font-medium">{displayName}</span>
            </p>
          )}
        </div>

        {/* 1. WAITING STATE */}
        {status === "pending" && (
          <div className="flex flex-col items-center space-y-5 my-2">
            {/* Pulsing Avatar / Icon */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full bg-[var(--brand)]/20 animate-ping opacity-75" />
              <div className="w-20 h-20 rounded-full bg-[var(--brand)] flex items-center justify-center shadow-lg shadow-[var(--brand)]/30 text-white relative z-10">
                <div className="scale-125">{Icons.clock}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[var(--t1)]">
                {t("lobby.waitingTitle", "در انتظار تأیید هاست...")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.waitingDesc",
                  "درخواست ورود شما برای مدیر جلسه ارسال شد. به محض تأیید به طور خودکار متصل خواهید شد.",
                )}
              </p>
            </div>

            {/* Waiting Timer */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-xs font-mono text-[var(--brand)]">
              <div className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            {/* Host not present helper if waiting > 2 mins */}
            {elapsedSeconds >= 120 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-300 text-xs leading-relaxed max-w-xs text-right animate-in fade-in duration-300 flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{Icons.people}</div>
                <span>
                  {t(
                    "lobby.hostNotPresent",
                    "به نظر می‌رسد هاست هنوز در اتاق حاضر نشده است. می‌توانید منتظر بمانید یا بعداً وارد شوید.",
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 2. DENIED STATE */}
        {status === "denied" && (
          <div className="flex flex-col items-center space-y-4 my-2">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/20">
              <div className="scale-125">{Icons.userX}</div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-300">
                {t("lobby.deniedTitle", "ورود شما تأیید نشد")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.deniedDesc",
                  "مدیر جلسه درخواست ورود شما را رد کرد. در صورت لزوم با هاست تماس بگیرید.",
                )}
              </p>
            </div>
          </div>
        )}

        {/* 3. ROOM LOCKED STATE */}
        {status === "locked" && (
          <div className="flex flex-col items-center space-y-4 my-2">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/20">
              <div className="scale-125">{Icons.lock}</div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-amber-600 dark:text-amber-300">
                {t("lobby.lockedTitle", "اتاق قفل شده است")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.lockedDesc",
                  "مدیر جلسه ورود افراد جدید به این اتاق را موقتاً بسته است.",
                )}
              </p>
            </div>
          </div>
        )}

        {/* 4. ROOM ENDED STATE */}
        {status === "room_ended" && (
          <div className="flex flex-col items-center space-y-4 my-2">
            <div className="w-20 h-20 rounded-full bg-[var(--s2)] border border-[var(--b)] flex items-center justify-center text-[var(--t3)] shadow-lg">
              <div className="scale-125">{Icons.phoneOff}</div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[var(--t1)]">
                {t("lobby.endedTitle", "جلسه به پایان رسید")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.endedDesc",
                  "این جلسه توسط هاست پایان یافته و دیگر در دسترس نیست.",
                )}
              </p>
            </div>
          </div>
        )}

        {/* 5. EXPIRED STATE */}
        {status === "expired" && (
          <div className="flex flex-col items-center space-y-4 my-2">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg">
              <div className="scale-125">{Icons.clock}</div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-amber-600 dark:text-amber-300">
                {t("lobby.expiredTitle", "زمان انتظار پایان یافت")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.expiredDesc",
                  "درخواست ورود شما منقضی شد. لطفاً دوباره تلاش کنید.",
                )}
              </p>
            </div>
          </div>
        )}

        {/* 6. NETWORK ERROR STATE */}
        {status === "network_error" && (
          <div className="flex flex-col items-center space-y-4 my-2">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-lg">
              <div className="scale-125">{Icons.wifiOff}</div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-300">
                {t("lobby.networkErrorTitle", "خطا در برقراری ارتباط")}
              </h3>
              <p className="text-xs text-[var(--t3)] max-w-xs leading-relaxed">
                {t(
                  "lobby.networkErrorDesc",
                  "ارتباط شما با سرور ناپایدار است. سیستم در حال تلاش مجدد است...",
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--brand)]">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
              <span>{t("lobby.reconnecting", "در حال تلاش مجدد...")}</span>
            </div>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="w-full mt-6 pt-6 border-t border-[var(--b)] flex items-center gap-3">
          {(status === "expired" ||
            status === "denied" ||
            status === "network_error") &&
            onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-h)] text-[var(--brand-text)] text-xs font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all cursor-pointer border-none flex items-center justify-center gap-2"
              >
                <span>{t("common.retry", "تلاش دوباره")}</span>
              </button>
            )}

          <button
            type="button"
            onClick={handleExit}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] text-[var(--t2)] hover:text-[var(--t1)] text-xs font-semibold border border-[var(--b)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{Icons.signOut}</span>
            <span>{t("lobby.leaveLobby", "ترک لابی / خروج")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
