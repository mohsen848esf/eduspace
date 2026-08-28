import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useLocale } from "@/i18n/useLocale";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useRoom } from "@/features/room/hooks/useRoom";
import { authApi } from "@/features/auth/api/auth.api";
import { useOrgContextStore } from "@/features/auth/store/orgContextStore";
import { queryKeys } from "@/lib/query-keys";
import { CreateOrgModal } from "../components/modals/CreateOrgModal";
import { JoinOrgModal } from "../components/modals/JoinOrgModal";
import {
  Video,
  ArrowRight,
  ArrowLeft,
  Building2,
  KeyRound,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PersonalHomePage() {
  const { t } = useTranslation(["dashboard", "common", "notifications"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { createRoom, isLoading: roomLoading } = useRoom();
  const navigate = useNavigate();

  const isFarsi = language === "fa";
  const localeTag = isFarsi ? "fa-IR" : "en-US";

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomInput, setRoomInput] = useState("");

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>("");
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(localeTag, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [localeTag]);

  // Invitations query
  const { data: invitations = [], refetch: refetchInvitations } = useQuery({
    queryKey: queryKeys.auth.invitations,
    queryFn: authApi.getInvitations,
  });

  const handleRespondInvite = async (orgSlug: string, action: "accept" | "decline") => {
    try {
      await authApi.respondInvitation(orgSlug, action);
      refetchInvitations();
      if (action === "accept") {
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(orgSlug);
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      alert(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          "Failed to respond to invitation",
      );
    }
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomInput.trim().replace(/^.*\/room\//, "");
    if (cleaned) {
      navigate(`/room/${cleaned}`);
    }
  };

  // Generate 7 days for the top date carousel
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + (i - 1)); // start from yesterday to +5 days
    const isToday = i === 1;
    const weekdayName = d.toLocaleDateString(localeTag, { weekday: "short" });
    const dayNumber = d.toLocaleDateString(localeTag, { day: "numeric" });
    return {
      offset: i - 1,
      isToday,
      weekdayName,
      dayNumber,
      fullDate: d.toLocaleDateString(localeTag, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    };
  });

  const activeDay = weekDays.find((d) => d.offset === selectedDayOffset) || weekDays[1];

  return (
    <AppShell
      title="EduSpace"
      subtitle={isFarsi ? "جلسات و کلاس‌های آنلاین" : "Video Meetings"}
      activeNav="dashboard"
    >
      <div className="max-w-5xl mx-auto w-full py-2 md:py-6 px-2 sm:px-4 flex flex-col gap-8 animate-in fade-in duration-300">
        {/* 1. Header Date & Day Strip (Google Meet Style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--b)]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 flex items-center justify-center font-bold shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-black text-[var(--t1)]">
                {activeDay.fullDate}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{currentTime || "..."}</span>
                <span>•</span>
                <span>{isFarsi ? "فضای شخصی کاربری" : "Personal Workspace"}</span>
              </div>
            </div>
          </div>

          {/* Mini 7-day strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {weekDays.map((day) => {
              const isSelected = day.offset === selectedDayOffset;
              return (
                <button
                  key={day.offset}
                  onClick={() => setSelectedDayOffset(day.offset)}
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-14 rounded-2xl transition-all cursor-pointer border",
                    isSelected
                      ? "bg-[var(--brand)] text-white border-[var(--brand)] shadow-md shadow-[var(--brand)]/25 scale-105"
                      : "bg-[var(--s1)] text-[var(--t2)] border-[var(--b)] hover:bg-[var(--s2)] hover:text-[var(--t1)]",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                    {day.weekdayName}
                  </span>
                  <span className="text-sm font-black mt-0.5">{day.dayNumber}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Hero Stage: Illustration & Quick Launch Actions */}
        <div className="flex flex-col items-center justify-center text-center py-6 md:py-10 px-4 bg-gradient-to-b from-[var(--s1)]/80 to-[var(--s2)]/40 rounded-3xl border border-[var(--b)]/60 shadow-sm relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Modern Geometric Vector Illustration */}
          <div className="w-48 h-36 mb-6 relative flex items-center justify-center">
            <svg
              viewBox="0 0 200 150"
              className="w-full h-full drop-shadow-sm select-none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Desk Base */}
              <path
                d="M20 120H180"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-[var(--t3)]/40"
              />
              {/* Sun / Lamp Light */}
              <circle cx="150" cy="35" r="14" fill="#FBBF24" fillOpacity="0.85" />
              {/* Video Screen Monitor */}
              <rect
                x="65"
                y="45"
                width="70"
                height="50"
                rx="8"
                fill="var(--s1)"
                stroke="var(--brand)"
                strokeWidth="2.5"
              />
              <rect x="73" y="53" width="54" height="34" rx="4" fill="var(--brand)" fillOpacity="0.12" />
              {/* Video Camera Icon */}
              <path
                d="M93 64H103C104.5 64 105.5 65 105.5 66.5V73.5C105.5 75 104.5 76 103 76H93C91.5 76 90.5 75 90.5 73.5V66.5C90.5 65 91.5 64 93 64Z"
                fill="var(--brand)"
              />
              <path d="M106 67L111 64V76L106 73V67Z" fill="var(--brand)" />
              {/* Coffee Cup */}
              <rect x="40" y="95" width="18" height="24" rx="4" fill="#F59E0B" />
              <path
                d="M49 85C49 85 52 89 49 92"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Pen & Notebook */}
              <rect
                x="142"
                y="85"
                width="24"
                height="34"
                rx="3"
                transform="rotate(15 142 85)"
                fill="#EC4899"
                fillOpacity="0.8"
              />
            </svg>
          </div>

          {/* Headline & Subtitle */}
          <h3 className="text-xl sm:text-2xl font-black text-[var(--t1)] tracking-tight max-w-md">
            {isFarsi
              ? "جلسه‌ای برای امروز برنامه‌ریزی نشده است"
              : "No meetings scheduled for today"}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--t3)] mt-2 max-w-lg leading-relaxed">
            {isFarsi
              ? "می‌توانید همین حالا یک جلسه فوری شروع کنید، با وارد کردن کد به جلسه دیگران بپیوندید یا سازمان آموزشی خود را راه‌اندازی نمایید."
              : "Start an instant video meeting, join using a room code, or create an organization to unlock full LMS capabilities."}
          </p>

          {/* Quick Meeting Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full max-w-md">
            <button
              onClick={() =>
                createRoom({
                  name: t("dashboard:roomDefault", {
                    name: user?.full_name || user?.username || "",
                  }),
                  max_participants: 20,
                  is_recorded: false,
                })
              }
              disabled={roomLoading}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[var(--brand)] hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-[var(--brand)]/25 transition-all active:scale-[0.98] cursor-pointer border-none"
            >
              <Video className="w-4 h-4" />
              <span>{isFarsi ? "+ شروع جلسه جدید" : "+ New Meeting"}</span>
            </button>

            <form
              onSubmit={handleJoinWithCode}
              className="w-full sm:w-auto flex-1 flex items-center bg-[var(--s1)] border border-[var(--b)] rounded-2xl ps-3.5 pe-1.5 py-1.5 focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)] transition-all shadow-sm"
            >
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder={isFarsi ? "کد یا لینک اتاق..." : "Enter code or link"}
                className="w-full bg-transparent border-none text-xs text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!roomInput.trim()}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border-none",
                  roomInput.trim()
                    ? "bg-[var(--brand)] text-white hover:opacity-90 shadow-sm"
                    : "bg-transparent text-[var(--t3)] opacity-50 cursor-not-allowed",
                )}
              >
                {isFarsi ? "پیوستن" : "Join"}
              </button>
            </form>
          </div>
        </div>

        {/* 3. Creative Bento Cards: Upgrade to Enterprise LMS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--brand)]" />
              <span>{isFarsi ? "امکانات سازمانی و آکادمی" : "Enterprise & Academy"}</span>
            </h4>
            <span className="text-[11px] text-[var(--t3)]">
              {isFarsi ? "مدیریت کلاس‌ها، دانشجویان و امور مالی" : "LMS, Classes & Billing"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Create Organization */}
            <div className="relative group bg-[var(--s1)] hover:bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-3xl p-6 transition-all duration-200 shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 end-0 w-32 h-32 bg-[var(--brand)]/5 rounded-full blur-2xl group-hover:bg-[var(--brand)]/10 transition-colors pointer-events-none" />

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-indigo-500/20">
                  <Building2 className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-[var(--t1)] flex items-center gap-2">
                    <span>{isFarsi ? "ایجاد سازمان و آکادمی جدید" : "Create Organization"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 text-[10px] font-bold">
                      {isFarsi ? "ویژه مدیران" : "LMS"}
                    </span>
                  </h4>
                  <p className="text-xs text-[var(--t3)] leading-relaxed">
                    {isFarsi
                      ? "راه‌اندازی آموزشگاه، مدیریت دوره‌ها، تعریف کلاس‌ها، اساتید، حضور و غیاب، آزمون‌ساز و سیستم مالی متمرکز."
                      : "Launch your academy, organize courses, schedule classes, track attendance, exams, and financials."}
                  </p>
                </div>

                {/* Feature Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    isFarsi ? "کلاس‌های آنلاین" : "Live Classes",
                    isFarsi ? "مدیریت دوره‌ها" : "Courses",
                    isFarsi ? "دفتر کل مالی" : "Financial Ledger",
                    isFarsi ? "حضور و غیاب" : "Attendance",
                  ].map((badge, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[var(--s3)] text-[10px] font-medium text-[var(--t2)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--s2)] hover:bg-[var(--brand)] text-[var(--t1)] hover:text-white border border-[var(--b)] hover:border-transparent font-bold text-xs transition-all cursor-pointer group/btn shadow-none hover:shadow-md hover:shadow-[var(--brand)]/20"
                >
                  <span>{isFarsi ? "شروع و ساخت سازمان ✨" : "Create Organization Now"}</span>
                  {isFarsi ? (
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-x-1" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Join Organization */}
            <div className="relative group bg-[var(--s1)] hover:bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-3xl p-6 transition-all duration-200 shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 end-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-[var(--t1)] flex items-center gap-2">
                    <span>{isFarsi ? "پیوستن به سازمان موجود" : "Join Organization"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      {isFarsi ? "دانشجو / استاد" : "Invite"}
                    </span>
                  </h4>
                  <p className="text-xs text-[var(--t3)] leading-relaxed">
                    {isFarsi
                      ? "اگر از سمت مدرسه، دانشگاه یا آموزشگاه کد دعوت دارید، وارد نمایید تا به دوره‌ها و کلاس‌های خود دسترسی یابید."
                      : "Have an invite code or organization slug? Join to access your enrolled courses and classroom sessions."}
                  </p>
                </div>

                {/* Feature Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    isFarsi ? "کلاس‌های من" : "My Classes",
                    isFarsi ? "ارزیابی و نمرات" : "Grades",
                    isFarsi ? "تکالیف" : "Homework",
                    isFarsi ? "پرداخت‌ها" : "Payments",
                  ].map((badge, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[var(--s3)] text-[10px] font-medium text-[var(--t2)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--s2)] hover:bg-emerald-600 text-[var(--t1)] hover:text-white border border-[var(--b)] hover:border-transparent font-bold text-xs transition-all cursor-pointer group/btn shadow-none hover:shadow-md hover:shadow-emerald-600/20"
                >
                  <span>{isFarsi ? "پیوستن با کد دعوت 🔑" : "Join with Invite Code"}</span>
                  {isFarsi ? (
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-x-1" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Pending Invitations (if any) */}
        {invitations.length > 0 && (
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-3xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wider flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[var(--brand)]" />
              <span>{isFarsi ? "دعوت‌نامه‌های در انتظار پاسخ" : "Pending Invitations"}</span>
            </h4>

            <div className="divide-y divide-[var(--b)]">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 flex items-center justify-center text-lg font-bold shrink-0">
                      🏢
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-[var(--t1)]">
                        {invite.organization.name}
                      </h5>
                      <p className="text-xs text-[var(--t3)] mt-0.5">
                        {isFarsi
                          ? `نقش: ${invite.role || "عضو"} • دعوت‌کننده: ${invite.invited_by || "سازمان"}`
                          : `Role: ${invite.role || "Member"} • Invited by: ${invite.invited_by || "Admin"}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleRespondInvite(invite.organization.slug, "accept")}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer border-none"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isFarsi ? "قبول دعوت" : "Accept"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondInvite(invite.organization.slug, "decline")}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-[var(--s2)] hover:bg-[var(--red)]/10 text-[var(--t2)] hover:text-[var(--red)] text-xs font-bold transition-all cursor-pointer border border-[var(--b)]"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{isFarsi ? "رد" : "Decline"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateOrgModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        isFarsi={isFarsi}
      />
      <JoinOrgModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        isFarsi={isFarsi}
      />
    </AppShell>
  );
}
