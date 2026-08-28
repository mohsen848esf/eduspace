import React from "react";
import type { InspectorViewerProps } from "../types";
import type { OrgMember } from "@/features/auth/api/auth.api";
import type { Enrollment } from "@/features/dashboard/types/crm.types";

export interface MentorInspectorProps extends InspectorViewerProps<OrgMember> {
  mentorStudents: Enrollment[];
  loadingExtra: boolean;
}

export const MentorInspector: React.FC<MentorInspectorProps> = ({
  data,
  isFarsi,
  onNavigate,
  mentorStudents,
  loadingExtra,
}) => {
  const user = data.user_details || {};
  const name = user.full_name || user.username || "";
  const email = user.email || "";
  const roleName = data.role_name || "MENTOR";
  const statusLabel = data.is_active
    ? isFarsi
      ? "فعال"
      : "Active"
    : isFarsi
    ? "غیرفعال"
    : "Inactive";

  const renderListSkeleton = (count = 2) => (
    <div className="space-y-2 animate-pulse w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="h-12 bg-slate-800/50 rounded-xl border border-[var(--b)]" />
      ))}
    </div>
  );

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

      {/* Mentored Students */}
      <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "دانش‌آموزان تحت منتورینگ" : "Mentored Students"}
        </h4>
        {loadingExtra ? (
          renderListSkeleton(3)
        ) : mentorStudents.length === 0 ? (
          <div className="text-xs text-[var(--t3)] italic bg-[var(--s2)] p-3 rounded-xl border border-[var(--b)]">
            {isFarsi
              ? "کلاس یا دانش‌آموزی تحت منتورینگ یافت نشد."
              : "No mentored students found."}
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {mentorStudents.map((enroll) => (
              <div
                key={enroll.id}
                className="flex justify-between items-center p-3 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-xs"
              >
                <div className="flex flex-col min-w-0">
                  <button
                    onClick={() => onNavigate("student", enroll.student)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate"
                  >
                    {enroll.student_full_name ||
                      enroll.student_username ||
                      `#${enroll.student}`}
                  </button>
                  <span className="text-[10px] text-[var(--t3)] mt-0.5">
                    {isFarsi ? "کلاس:" : "Class:"} <strong>{enroll.class_name}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorInspector;
