import React from "react";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getMediaUrl } from "@/lib/api/client";

export interface OrgWelcomeBannerProps {
  user: any;
  activeOrg: any;
  activeRole: string | null;
  isFarsi: boolean;
  localeTag: string;
}

export const OrgWelcomeBanner: React.FC<OrgWelcomeBannerProps> = ({
  user,
  activeOrg,
  activeRole,
  isFarsi,
  localeTag,
}) => {
  const userName = user?.full_name || user?.username || (isFarsi ? "کاربر گرامی" : "User");
  const orgName = activeOrg?.name || (isFarsi ? "آکادمی آموزشی" : "Educational Academy");
  const orgSlogan = activeOrg?.branding?.slogan || (isFarsi ? "سامانه یکپارچه آموزش و کلاس‌های آنلاین" : "Interactive Learning & Classroom Space");

  const todayFormatted = new Date().toLocaleDateString(localeTag, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const getRoleLabel = (role: string | null) => {
    switch (role?.toLowerCase()) {
      case "owner":
      case "admin":
        return isFarsi ? "مدیر آکادمی" : "Academy Admin";
      case "teacher":
        return isFarsi ? "استاد / مدرس" : "Instructor";
      case "mentor":
        return isFarsi ? "منتور آموزشی" : "Mentor";
      case "student":
        return isFarsi ? "دانشجو / فراگیر" : "Student";
      default:
        return isFarsi ? "عضو آکادمی" : "Member";
    }
  };

  return (
    <div className="w-full relative overflow-hidden rounded-3xl p-5 md:p-6 bg-gradient-to-r from-[var(--s2)] to-[var(--s3)] border border-[var(--b)] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all">
      {/* Ambient soft glow */}
      <div className="absolute top-0 end-0 w-64 h-64 bg-[var(--brand)]/5 rounded-full blur-3xl pointer-events-none" />

      {/* User Greeting & Date Info */}
      <div className="flex flex-col min-w-0 text-start z-10 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg md:text-xl font-black text-[var(--t1)] flex items-center gap-2 tracking-tight">
            <span>{isFarsi ? "خوش آمدید" : "Welcome back"}</span>
            <span className="text-xl">👋</span>
            <span>، {userName}</span>
          </h1>

          <Badge variant="brand" className="px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>{getRoleLabel(activeRole)}</span>
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--t3)] font-medium">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--brand)]" />
            <span>{todayFormatted}</span>
          </div>
          <span className="text-[var(--b)] opacity-80">•</span>
          <div className="flex items-center gap-1 text-[var(--green)]">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            <span>{isFarsi ? "آنلاین در آکادمی" : "Online in Academy"}</span>
          </div>
        </div>
      </div>

      {/* Organization Branding Section */}
      <div className="flex items-center gap-3.5 self-stretch md:self-auto justify-start md:justify-end z-10 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--b)]/60">
        <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] border border-[var(--brand)]/30 text-[var(--brand)] flex items-center justify-center font-black text-xl shadow-sm flex-shrink-0 overflow-hidden">
          {activeOrg?.logo ? (
            <img
              src={getMediaUrl(activeOrg.logo)}
              alt={orgName}
              className="w-full h-full object-cover"
            />
          ) : (
            orgName.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex flex-col text-start max-w-[240px]">
          <span className="text-sm md:text-base font-extrabold text-[var(--t1)] leading-tight truncate flex items-center gap-1.5">
            <span>{orgName}</span>
            <Sparkles className="w-3.5 h-3.5 text-[var(--brand)] flex-shrink-0" />
          </span>
          <span className="text-[11px] text-[var(--t3)] font-medium mt-0.5 leading-snug line-clamp-1">
            {orgSlogan}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrgWelcomeBanner;
