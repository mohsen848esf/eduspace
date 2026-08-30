import React from "react";
import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { Course } from "@/features/dashboard/types/crm.types";

export interface CourseInspectorProps extends InspectorViewerProps<Course> {
  onOpenChange: (open: boolean) => void;
}

export const CourseInspector: React.FC<CourseInspectorProps> = ({
  data,
  isFarsi,
  onOpenChange,
}) => {
  return (
    <div className="space-y-6 p-4">
      <div className="border-b border-[var(--b)] pb-5 text-left">
        <span className="text-[10px] font-bold tracking-wider text-[var(--brand-text)] bg-[var(--brand)]/15 px-2.5 py-0.5 rounded-full uppercase">
          {data.code}
        </span>
        <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.title}</h3>
        <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
          {data.description ||
            (isFarsi
              ? "توضیحی برای این دوره ثبت نشده است."
              : "No description provided.")}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "خلاصه وضعیت" : "Course Summary"}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] text-left">
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "شهریه دوره" : "Tuition Fee"}
            </span>
            <span className="font-bold text-[var(--t1)] text-md">
              ${parseFloat(data.price || "0").toFixed(2)}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "تاریخ ایجاد" : "Created Date"}
            </span>
            <span className="font-bold text-[var(--t1)]">
              {new Date(data.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "میانبرهای ناوبری" : "Linked Resource Navigation"}
        </h4>
        <Link
          to={`/academic/classes?course=${data.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>{isFarsi ? "مشاهده کلاس‌های این دوره" : "View Classes & Sections"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default CourseInspector;
