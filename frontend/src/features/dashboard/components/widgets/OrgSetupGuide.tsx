import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  BookOpen,
  CalendarPlus,
  UserPlus,
  Palette,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Button from "@/components/ui/Button";

export interface OrgSetupGuideProps {
  isFarsi: boolean;
  hasCourses: boolean;
  hasClasses: boolean;
  hasMembers: boolean;
  hasBranding: boolean;
}

export const OrgSetupGuide: React.FC<OrgSetupGuideProps> = ({
  isFarsi,
  hasCourses,
  hasClasses,
  hasMembers,
  hasBranding,
}) => {
  const steps = [
    {
      id: "course",
      title: isFarsi ? "۱. تعریف اولین دوره آموزشی" : "1. Create First Course",
      desc: isFarsi
        ? "سرفصل‌ها، توضیحات و قیمت دوره را برای آموزشگاه خود ثبت نمایید."
        : "Define your curriculum, description, and tuition fees.",
      link: "/academic/courses",
      actionText: isFarsi ? "ساخت دوره" : "Create Course",
      done: hasCourses,
      icon: <BookOpen className="w-5 h-5" />,
      iconBg: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
    },
    {
      id: "class",
      title: isFarsi ? "۲. زمان‌بندی کلاس و جلسات زنده" : "2. Schedule Classes & Sessions",
      desc: isFarsi
        ? "کلاس‌های آنلاین با زمان‌بندی خودکار یا دستی و استاد مرتبط ایجاد کنید."
        : "Set up interactive classrooms and automated schedule occurrences.",
      link: "/academic/classes",
      actionText: isFarsi ? "ایجاد کلاس" : "New Class",
      done: hasClasses,
      icon: <CalendarPlus className="w-5 h-5" />,
      iconBg: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-400",
    },
    {
      id: "members",
      title: isFarsi ? "۳. دعوت از اساتید و دانشجویان" : "3. Invite Teachers & Students",
      desc: isFarsi
        ? "کد دعوت ۶ رقمی را در اختیار اعضا قرار دهید یا مستقیماً دعوت کنید."
        : "Share your 6-digit organization code or invite users directly.",
      link: "/organization/members",
      actionText: isFarsi ? "مدیریت اعضا" : "Invite Members",
      done: hasMembers,
      icon: <UserPlus className="w-5 h-5" />,
      iconBg: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    },
    {
      id: "branding",
      title: isFarsi ? "۴. شخصی‌سازی برند و وایت‌لیبل" : "4. Academy Branding & Settings",
      desc: isFarsi
        ? "لوگو، شعار سازمانی، دامنه اختصاصی و پالت تم آکادمی خود را تنظیم کنید."
        : "Upload your academy logo, brand slogan, and custom domain settings.",
      link: "/organization/settings",
      actionText: isFarsi ? "تنظیمات برند" : "Customize",
      done: hasBranding,
      icon: <Palette className="w-5 h-5" />,
      iconBg: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="w-full bg-[var(--s2)] border border-[var(--brand)]/30 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-black text-[var(--t1)]">
              {isFarsi ? "راهنمای راه‌اندازی سریع آکادمی" : "Academy Quick Setup Checklist"}
            </h2>
          </div>
          <p className="text-xs text-[var(--t3)]">
            {isFarsi
              ? "برای شروع برگزاری کلاس‌ها و مدیریت دوره‌ها، مراحل زیر را گام‌به‌گام تکمیل کنید."
              : "Complete the setup checklist to start hosting classes and managing enrollments."}
          </p>
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-3 bg-[var(--s1)] border border-[var(--b)] px-4 py-2 rounded-2xl shrink-0">
          <div className="flex flex-col text-end">
            <span className="text-xs font-bold text-[var(--t1)]">
              {isFarsi ? `${completedCount} از ${steps.length} تکمیل شد` : `${completedCount} of ${steps.length} Done`}
            </span>
            <span className="text-[10px] text-[var(--t3)] font-mono">{progressPercent}%</span>
          </div>
          <div className="w-12 h-2 rounded-full bg-[var(--s3)] overflow-hidden">
            <div
              className="h-full bg-[var(--brand)] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              step.done
                ? "bg-[var(--s1)]/60 border-[var(--green)]/30"
                : "bg-[var(--s1)] border-[var(--b)] hover:border-[var(--brand)]/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${step.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                {step.done ? <CheckCircle2 className="w-5 h-5 text-[var(--green)]" /> : step.icon}
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--t1)] truncate">
                    {step.title}
                  </h4>
                  {step.done && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--green)]/15 text-[var(--green)] text-[10px] font-bold">
                      {isFarsi ? "تکمیل شد" : "Done"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link to={step.link} className="no-underline">
                <Button size="sm" variant={step.done ? "secondary" : "primary"} className="text-xs font-bold gap-1.5 shadow-sm">
                  <span>{step.actionText}</span>
                  {isFarsi ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrgSetupGuide;
