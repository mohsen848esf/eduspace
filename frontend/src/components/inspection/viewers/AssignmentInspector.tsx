import React from "react";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { Assignment } from "@/features/assessments/types";

export interface AssignmentInspectorProps extends InspectorViewerProps<Assignment> {
  onOpenChange: (open: boolean) => void;
}

export const AssignmentInspector: React.FC<AssignmentInspectorProps> = ({
  data,
  isFarsi,
  onNavigate,
  onOpenChange,
}) => {
  const isOverdue = data.due_date ? new Date(data.due_date) < new Date() : false;

  return (
    <div className="space-y-6 p-4 text-left">
      <div className="border-b border-[var(--b)] pb-5">
        <span
          className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
            isOverdue
              ? "bg-red-500/10 text-red-400"
              : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {isOverdue
            ? isFarsi
              ? "گذشته از سررسید"
              : "Overdue"
            : isFarsi
            ? "فعال"
            : "Active"}
        </span>
        <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.title}</h3>
        <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
          {data.description ||
            (isFarsi
              ? "توضیحی برای این تکلیف ثبت نشده است."
              : "No description provided.")}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "مشخصات تکلیف" : "Assignment Properties"}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "کلاس" : "Class"}
            </span>
            {data.academy_class ? (
              <button
                onClick={() => onNavigate("class", data.academy_class)}
                className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
              >
                {data.class_name || `#${data.academy_class}`}
              </button>
            ) : (
              <span className="font-bold text-[var(--t1)]">—</span>
            )}
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "تاریخ سررسید" : "Due Date"}
            </span>
            <span className="font-bold text-[var(--t1)]">
              {data.due_date
                ? new Date(data.due_date).toLocaleDateString()
                : isFarsi
                ? "ندارد"
                : "None"}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "تعداد تحویل‌ها" : "Submissions"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.submissions_count || 0}</span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "تصحیح شده" : "Graded"}
            </span>
            <span className="font-bold text-[var(--t1)]">{data.graded_count || 0}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}
        </h4>
        <Link
          to={`/academic/assignments/${data.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>
              {isFarsi
                ? "مشاهده جزئیات کامل تکلیف"
                : "View Full Assignment Details"}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default AssignmentInspector;
