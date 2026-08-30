import React from "react";
import { Link } from "react-router-dom";
import { Video, Clock, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { Session } from "@/features/sessions/types";

export interface SessionInspectorProps extends InspectorViewerProps<Session> {
  onOpenChange: (open: boolean) => void;
}

export const SessionInspector: React.FC<SessionInspectorProps> = ({
  data,
  isFarsi,
  onNavigate,
  onOpenChange,
}) => {
  const isLive = data.status === "live";

  return (
    <div className="space-y-6 p-4 text-left">
      <div className="border-b border-[var(--b)] pb-5">
        <span
          className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
            isLive
              ? "bg-red-500/10 text-red-400 animate-pulse"
              : "bg-indigo-500/10 text-indigo-400"
          }`}
        >
          {data.status || "scheduled"}
        </span>
        <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.title}</h3>
        <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
          {isFarsi ? "کلاس:" : "Class:"}{" "}
          {data.academy_class ? (
            <button
              onClick={() => onNavigate("class", data.academy_class)}
              className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-xs"
            >
              {data.academy_class_name || `#${data.academy_class}`}
            </button>
          ) : (
            <strong>{data.academy_class_name || "—"}</strong>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "مشخصات جلسه" : "Session Details"}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "میزبان / استاد" : "Host"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.host_name || "—"}</span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "کد اتاق" : "Room Code"}
            </span>
            <span className="font-bold text-[var(--t1)] font-mono">
              {data.active_room_code || data.active_room || "—"}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "زمان شروع" : "Scheduled Start"}
            </span>
            <span className="font-bold text-[var(--t1)]">
              {data.scheduled_start ? new Date(data.scheduled_start).toLocaleString() : "—"}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "مدت زمان" : "Duration"}
            </span>
            <span className="font-bold text-[var(--t1)]">
              {data.scheduled_start && data.scheduled_end
                ? `${Math.max(0, Math.round((new Date(data.scheduled_end).getTime() - new Date(data.scheduled_start).getTime()) / 60_000))} min`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}
        </h4>
        {isLive && data.active_room_code && (
          <Link
            to={`/room/${data.active_room_code}`}
            onClick={() => onOpenChange(false)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-400 no-underline font-bold transition-all"
          >
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              <span>{isFarsi ? "ورود به اتاق زنده" : "Join Live Room"}</span>
            </div>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        <Link
          to={`/academic/sessions/${data.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>{isFarsi ? "مشاهده جزئیات کامل جلسه" : "View Full Session Page"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default SessionInspector;
