import React from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { OrgMember } from "@/features/auth/api/auth.api";

export interface TeacherInspectorProps extends InspectorViewerProps<OrgMember> {
  onOpenChange: (open: boolean) => void;
}

export const TeacherInspector: React.FC<TeacherInspectorProps> = ({
  data,
  isFarsi,
  onOpenChange,
}) => {
  const user = data.user_details || {};
  const name = user.full_name || user.username || "";
  const email = user.email || "";
  const roleName = data.role_name || "TEACHER";
  const statusLabel = data.is_active
    ? isFarsi
      ? "فعال"
      : "Active"
    : isFarsi
    ? "غیرفعال"
    : "Inactive";

  return (
    <div className="space-y-6 p-4">
      {/* Header Profile */}
      <div className="flex items-center gap-4 border-b border-[var(--b)] pb-5">
        <div className="w-16 h-16 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-2xl font-bold overflow-hidden flex-shrink-0">
          {user.avatar ? (
            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[var(--t1)] text-lg truncate">{name}</span>
          <span className="text-xs text-[var(--t3)] truncate mt-1">@{user.username}</span>
          <span className="text-[10px] text-[var(--t3)] truncate mt-0.5">{email}</span>
        </div>
      </div>

      {/* Summary Profile */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "مشخصات کلی" : "Summary Profile"}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "نقش سازمانی" : "Org Role"}
            </span>
            <span className="font-bold text-[var(--t1)]">{roleName}</span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "وضعیت عضویت" : "Status"}
            </span>
            <span
              className={`font-bold ${data.is_active ? "text-[var(--green)]" : "text-[var(--t3)]"}`}
            >
              {statusLabel}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "نوع قرارداد" : "Contract Type"}
            </span>
            <span className="font-bold text-[var(--t1)] capitalize">
              {data.contract_type?.replace("_", " ") || "Full Time"}
            </span>
          </div>
          <div>
            <span className="block text-[var(--t3)] font-medium mb-1">
              {isFarsi ? "عضویت از" : "Joined"}
            </span>
            <span className="font-bold text-[var(--t1)]">
              {new Date(data.joined_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "ناوبری هوشمند و اکشن‌ها" : "Quick Actions"}
        </h4>
        <Link
          to={`/academic/classes?teacher=${data.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>{isFarsi ? "کلاس‌های تحت تدریس" : "View Taught Classes"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          to={`/academic/sessions`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{isFarsi ? "جلسات و زمان‌بندی‌ها" : "View Sessions Schedule"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default TeacherInspector;
