import React from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  Radio,
  ChevronRight,
  User,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { Session } from "@/features/sessions/types";

export interface OrgScheduleWidgetProps {
  todaySessions: Session[];
  isFarsi: boolean;
  localeTag: string;
}

export const OrgScheduleWidget: React.FC<OrgScheduleWidgetProps> = ({
  todaySessions,
  isFarsi,
  localeTag,
}) => {
  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return "--:--";
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString(localeTag, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader
        action={
          <Link
            to="/academic/sessions"
            className="text-xs font-bold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1 transition-colors"
          >
            <span>{isFarsi ? "مشاهده همه جلسات" : "View All Sessions"}</span>
            {isFarsi ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>
        }
      >
        <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--brand)]" />
          <span>{isFarsi ? "برنامه کلاسی و جلسات امروز" : "Today's Class Schedule"}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center">
        {todaySessions.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 text-[var(--t3)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex items-center justify-center text-xl">
              🗓️
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-[var(--t2)]">
                {isFarsi ? "جلسه‌ای برای امروز زمان‌بندی نشده است" : "No sessions scheduled for today"}
              </h4>
              <p className="text-[11px] text-[var(--t3)] max-w-xs">
                {isFarsi
                  ? "می‌توانید تقویم آموزشی را بررسی کرده یا جلسه جدیدی ایجاد نمایید."
                  : "Check the full academic calendar or schedule a new classroom session."}
              </p>
            </div>
            <Link to="/academic/sessions" className="no-underline pt-1">
              <Button size="sm" variant="secondary" className="text-xs font-bold">
                {isFarsi ? "تقویم جلسات" : "Session Calendar"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--b)]/60">
            {todaySessions.map((session) => {
              const isLive = session.status === "live" || !!session.active_room_code;
              return (
                <div
                  key={session.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-[var(--t1)] truncate">
                        {session.title || session.academy_class_name || (isFarsi ? "جلسه کلاسی" : "Class Session")}
                      </span>
                      {isLive ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--green)]/15 text-[var(--green)] text-[10px] font-bold animate-pulse">
                          <Radio className="w-3 h-3" />
                          <span>{isFarsi ? "زنده" : "LIVE"}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--t3)] text-[10px] font-medium">
                          {isFarsi ? "زمان‌بندی‌شده" : "Scheduled"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--t3)]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[var(--brand)]" />
                        <span className="font-mono">
                          {formatTime(session.scheduled_start)} - {formatTime(session.scheduled_end)}
                        </span>
                      </div>
                      {session.host_name && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{session.host_name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isLive && session.active_room_code ? (
                      <Link to={`/room/${session.active_room_code}`} className="no-underline">
                        <Button size="sm" variant="primary" className="text-xs font-bold gap-1 shadow-sm">
                          <Radio className="w-3 h-3" />
                          <span>{isFarsi ? "ورود به کلاس" : "Join Room"}</span>
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/academic/sessions/${session.id}`} className="no-underline">
                        <Button size="sm" variant="secondary" className="text-xs font-bold">
                          <span>{isFarsi ? "مشاهده جزئیات" : "Details"}</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrgScheduleWidget;
