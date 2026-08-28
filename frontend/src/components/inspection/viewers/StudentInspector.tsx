import React from "react";
import { Link } from "react-router-dom";
import { Receipt, BookOpen, ArrowRight } from "lucide-react";
import type { InspectorViewerProps } from "../types";
import type { OrgMember } from "@/features/auth/api/auth.api";
import type {
  Enrollment,
  TuitionInvoice,
} from "@/features/dashboard/types/crm.types";

export interface StudentInspectorProps extends InspectorViewerProps<OrgMember> {
  studentEnrollments: Enrollment[];
  studentInvoices: TuitionInvoice[];
  attendanceRate: number | null;
  missingAssignments: number | null;
  loadingExtra: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StudentInspector: React.FC<StudentInspectorProps> = ({
  data,
  isFarsi,
  onNavigate,
  studentEnrollments,
  studentInvoices,
  attendanceRate,
  missingAssignments,
  loadingExtra,
  onOpenChange,
}) => {
  const user = data.user_details || {};
  const name = user.full_name || user.username || "";
  const email = user.email || "";
  const roleName = data.role_name || "STUDENT";
  const statusLabel = data.is_active
    ? isFarsi
      ? "فعال"
      : "Active"
    : isFarsi
    ? "غیرفعال"
    : "Inactive";
  const userId = user.id || data.user;

  const renderKpiSkeleton = () => (
    <div className="grid grid-cols-2 gap-4 bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] animate-pulse w-full">
      <div className="space-y-2">
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-4 bg-slate-800 rounded w-1/3" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-4 bg-slate-800 rounded w-1/3" />
      </div>
    </div>
  );

  const renderListSkeleton = (count = 2) => (
    <div className="space-y-2 animate-pulse w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="h-12 bg-slate-800/50 rounded-xl border border-[var(--b)]" />
      ))}
    </div>
  );

  const outstandingInvoices = studentInvoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
  );
  const totalOutstanding = outstandingInvoices.reduce(
    (sum, invoice) => sum + parseFloat(invoice.amount || "0"),
    0,
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

      {/* Academic KPIs */}
      <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "وضعیت تحصیلی" : "Academic KPIs"}
        </h4>
        {loadingExtra ? (
          renderKpiSkeleton()
        ) : (
          <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
            <div>
              <span className="block text-[var(--t3)] font-medium mb-1">
                {isFarsi ? "نرخ حضور و غیاب" : "Attendance Rate"}
              </span>
              <span
                className={`font-bold text-md ${
                  attendanceRate !== null && attendanceRate < 75
                    ? "text-red-500"
                    : "text-[var(--green)]"
                }`}
              >
                {attendanceRate !== null ? `${attendanceRate}%` : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[var(--t3)] font-medium mb-1">
                {isFarsi ? "تکالیف تحویل‌نشده" : "Missing Assignments"}
              </span>
              <span
                className={`font-bold text-md ${
                  missingAssignments !== null && missingAssignments > 0
                    ? "text-amber-500"
                    : "text-[var(--green)]"
                }`}
              >
                {missingAssignments !== null ? missingAssignments : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active Enrolled Classes */}
      <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "کلاس‌های فعال ثبت‌نامی" : "Active Enrolled Classes"}
        </h4>
        {loadingExtra ? (
          renderListSkeleton(2)
        ) : studentEnrollments.length === 0 ? (
          <div className="text-xs text-[var(--t3)] italic bg-[var(--s2)] p-3 rounded-xl border border-[var(--b)]">
            {isFarsi ? "کلاس فعالی ثبت نشده است." : "No active classes enrolled."}
          </div>
        ) : (
          <div className="space-y-2">
            {studentEnrollments.map((enroll) => (
              <div
                key={enroll.id}
                className="flex justify-between items-center p-3 rounded-xl bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/20 transition-all text-xs"
              >
                <div className="flex flex-col min-w-0">
                  <button
                    onClick={() => onNavigate("class", enroll.academy_class)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate"
                  >
                    {enroll.class_name || `#${enroll.academy_class}`}
                  </button>
                  <span className="text-[10px] text-[var(--t3)] mt-0.5">
                    {isFarsi ? "ثبت‌نام:" : "Enrolled:"}{" "}
                    {new Date(enroll.enrolled_at).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    enroll.completion_status === "completed"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : enroll.completion_status === "dropped"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-indigo-500/10 text-indigo-400"
                  }`}
                >
                  {enroll.completion_status || "in_progress"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financial Balance Info */}
      <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "وضعیت مالی" : "Financial Balance"}
        </h4>
        {loadingExtra ? (
          renderListSkeleton(2)
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">
                  {isFarsi ? "مانده بدهی شهریه" : "Outstanding Balance"}
                </span>
                <span
                  className={`font-bold text-md ${
                    totalOutstanding > 0 ? "text-amber-500" : "text-[var(--green)]"
                  }`}
                >
                  ${totalOutstanding.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">
                  {isFarsi ? "فاکتورهای پرداخت نشده" : "Unpaid Invoices"}
                </span>
                <span className="font-bold text-[var(--t1)] text-md">
                  {outstandingInvoices.length}
                </span>
              </div>
            </div>

            {outstandingInvoices.length > 0 && (
              <div className="space-y-2">
                {outstandingInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex justify-between items-center p-3 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <button
                        onClick={() => onNavigate("invoice", inv.id)}
                        className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate"
                      >
                        {inv.invoice_number || `#${inv.id}`}
                      </button>
                      <span className="text-[10px] text-[var(--t3)] mt-0.5">
                        {isFarsi ? "سررسید:" : "Due:"}{" "}
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <span className="font-bold text-amber-400">
                      ${parseFloat(inv.amount || "0").toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">
          {isFarsi ? "ناوبری هوشمند و اکشن‌ها" : "Quick Actions"}
        </h4>
        <Link
          to={`/finance/ledger?student=${encodeURIComponent(user.username)}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-pink-400" />
            <span>{isFarsi ? "مشاهده تراکنش‌ها و شهریه" : "View Payments & Invoices"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          to={`/finance/ledger?action=issue_invoice&student_id=${userId}&student_name=${encodeURIComponent(
            name
          )}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>{isFarsi ? "صدور فاکتور جدید" : "Issue New Invoice"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          to={`/crm/members?student_id=${user.id}`}
          onClick={() => onOpenChange(false)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>{isFarsi ? "مشاهده ثبت‌نام‌های درسی" : "View Course Enrollments"}</span>
          </div>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
};

export default StudentInspector;
