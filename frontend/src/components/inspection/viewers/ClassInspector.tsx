import React from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { AcademyClass } from "@/features/dashboard/types/crm.types";

export interface ClassInspectorProps extends InspectorViewerProps<AcademyClass> {
  onOpenChange: (open: boolean) => void;
}

export const ClassInspector: React.FC<ClassInspectorProps> = ({
  data,
  isFarsi,
  onNavigate,
  onOpenChange,
}) => {
  return (
    <div className="space-y-6 p-4">
      <div className="border-b border-[var(--b)] pb-5 text-left">
        <span className="text-[10px] font-bold tracking-wider text-[var(--brand-text)] bg-[var(--brand)]/15 px-2.5 py-0.5 rounded-full uppercase">
          {data.course_code || "CLASS"}
        </span>
        <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.name}</h3>
        <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
          {isFarsi ? "دوره:" : "Course:"}{" "}
          {data.course ? (
            <button
              onClick={() => onNavigate("course", data.course)}
              className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-xs align-baseline"
            >
              {data.course_title}
            </button>
          ) : (
            <strong>{data.course_title}</strong>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "جزئیات کلاس" : "Class Schedule"}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] text-left">
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "مدرس اصلی" : "Lead Instructor"}
            </span>
            {data.teacher ? (
              <button
                onClick={() => onNavigate("teacher", data.teacher!)}
                className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
              >
                {data.teacher_name || "Unassigned"}
              </button>
            ) : (
              <span className="font-bold text-[var(--t1)]">
                {data.teacher_name || "Unassigned"}
              </span>
            )}
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "منتور" : "Mentor"}
            </span>
            {data.mentor ? (
              <button
                onClick={() => onNavigate("mentor", data.mentor!)}
                className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
              >
                {data.mentor_name || "Unassigned"}
              </button>
            ) : (
              <span className="font-bold text-[var(--t1)]">
                {data.mentor_name || "Unassigned"}
              </span>
            )}
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "اتاق پیش‌فرض" : "Default Room"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.room || "Live Room"}</span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "کل جلسات" : "Total Sessions"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.session_count || 0}</span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "تاریخ شروع" : "Start Date"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.start_date || "Not set"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}
        </h4>
        <Link
          to={`/academic/sessions?class=${data.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>{isFarsi ? "مشاهده تمام جلسات" : "View Scheduled Sessions"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default ClassInspector;
