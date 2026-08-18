import React from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import type { LobbyRequest } from "../api/room.api";

interface LobbyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requests: LobbyRequest[];
  admittingId: number | null;
  denyingId: number | null;
  isBatchAction: boolean;
  onAdmit: (id: number) => void;
  onDeny: (id: number) => void;
  onAdmitAll: () => void;
  onDenyAll: () => void;
}

export const LobbyPanel: React.FC<LobbyPanelProps> = ({
  isOpen,
  onClose,
  requests,
  admittingId,
  denyingId,
  isBatchAction,
  onAdmit,
  onDeny,
  onAdmitAll,
  onDenyAll,
}) => {
  const { t } = useTranslation("room");

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute bottom-[76px] right-6 z-[100] w-96 max-w-[calc(100vw-2rem)]",
        "bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl p-4 text-white animate-in fade-in zoom-in-95 duration-150 select-none flex flex-col max-h-[500px]",
      )}
      style={{
        boxShadow:
          "0 25px 50px -12px rgba(0,0,0,0.7), 0 0 25px rgba(99,102,241,0.25)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400">{Icons.shield}</span>
          <span className="text-xs font-bold text-gray-100">
            {t("lobby.hostPanelTitle", "افراد در انتظار ورود")}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {requests.length}
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

      {/* Batch Actions (if >= 2 requests) */}
      {requests.length >= 2 && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
          <button
            type="button"
            disabled={isBatchAction}
            onClick={onAdmitAll}
            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>{Icons.check}</span>
            <span>{t("lobby.admitAll", "تأیید همه")}</span>
          </button>
          <button
            type="button"
            disabled={isBatchAction}
            onClick={onDenyAll}
            className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-[11px] font-semibold border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>{Icons.x}</span>
            <span>{t("lobby.denyAll", "رد همه")}</span>
          </button>
        </div>
      )}

      {/* Requests List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none">
        {requests.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-gray-400">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-2">
              {Icons.userCheck}
            </div>
            <p className="text-xs font-medium text-gray-300">
              {t("lobby.noRequests", "هیچ درخواستی در انتظار تأیید نیست")}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {t(
                "lobby.noRequestsTip",
                "کاربرانی که با لینک دعوت می‌آیند اینجا نمایش داده می‌شوند",
              )}
            </p>
          </div>
        ) : (
          requests.map((req) => {
            const isAdmitting = admittingId === req.id;
            const isDenying = denyingId === req.id;

            return (
              <div
                key={req.id}
                className={cn(
                  "p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5",
                  req.is_guest
                    ? "bg-rose-950/30 border-rose-500/30 hover:border-rose-500/50"
                    : "bg-white/5 border-white/10 hover:border-white/20",
                )}
              >
                {/* User Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      req.is_guest
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
                    )}
                  >
                    {req.display_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-100 truncate block">
                        {req.display_name}
                      </span>
                      {req.is_guest ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                          {t("lobby.guestBadge", "مهمان")}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                          {t("lobby.userBadge", "کاربر")}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {t("lobby.waitingForJoin", "درخواست ورود")}
                    </div>
                  </div>
                </div>

                {/* Individual Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isAdmitting || isDenying || isBatchAction}
                    onClick={() => onAdmit(req.id)}
                    title={t("lobby.admit", "تأیید ورود")}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer border-none flex items-center justify-center disabled:opacity-50"
                  >
                    {Icons.check}
                  </button>
                  <button
                    type="button"
                    disabled={isAdmitting || isDenying || isBatchAction}
                    onClick={() => onDeny(req.id)}
                    title={t("lobby.deny", "رد ورود")}
                    className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    {Icons.x}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
