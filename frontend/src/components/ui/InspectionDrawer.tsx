import { useEffect, useState } from "react";
import { Drawer, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from "../layout/Drawer";
import { useLocale } from "../../i18n/useLocale";
import client from "../../lib/api/client";
import Spinner from "./Spinner";
import { Link } from "react-router-dom";
import {
  X,
  User,
  BookOpen,
  Receipt,
  Calendar,
  UserCheck,
  Clock,
  ArrowRight
} from "lucide-react";

interface InspectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | null;
  entityId: string | number | null;
}

export default function InspectionDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
}: InspectionDrawerProps) {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entityType || !entityId) {
      setData(null);
      setError(null);
      return;
    }

    const fetchEntityDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        let endpoint = "";
        if (entityType === "student" || entityType === "teacher" || entityType === "mentor") {
          const res = await client.get("/auth/org-members/");
          const members = res.data || [];
          const match = members.find(
            (m: any) => m.user === Number(entityId) || m.id === Number(entityId)
          );
          if (match) {
            setData(match);
            setLoading(false);
            return;
          }
          endpoint = `/auth/org-members/${entityId}/`;
        } else if (entityType === "course") {
          endpoint = `/auth/courses/${entityId}/`;
        } else if (entityType === "class") {
          endpoint = `/auth/classes/${entityId}/`;
        } else if (entityType === "session") {
          // We query sessions lists and find matching id
          const res = await client.get("/auth/sessions/");
          const sessions = res.data || [];
          const match = sessions.find((s: any) => s.id === Number(entityId));
          if (match) {
            setData(match);
            setLoading(false);
            return;
          }
          endpoint = `/auth/sessions/${entityId}/`;
        } else if (entityType === "invoice") {
          endpoint = `/auth/invoices/${entityId}/`;
        }

        const response = await client.get(endpoint);
        setData(response.data);
      } catch (err: any) {
        console.error(err);
        setError(isFarsi ? "خطا در بارگذاری اطلاعات" : "Failed to load details.");
      } finally {
        setLoading(false);
      }
    };

    fetchEntityDetails();
  }, [open, entityType, entityId, isFarsi]);

  if (!open) return null;

  const renderHeader = () => {
    let icon = <User className="w-5 h-5 text-indigo-400" />;
    let title = "";

    switch (entityType) {
      case "student":
        title = isFarsi ? "جزئیات دانش‌آموز" : "Student Details";
        break;
      case "teacher":
        icon = <UserCheck className="w-5 h-5 text-emerald-400" />;
        title = isFarsi ? "جزئیات مدرس" : "Teacher Details";
        break;
      case "mentor":
        icon = <UserCheck className="w-5 h-5 text-cyan-400" />;
        title = isFarsi ? "جزئیات منتور" : "Mentor Details";
        break;
      case "course":
        icon = <BookOpen className="w-5 h-5 text-amber-400" />;
        title = isFarsi ? "مشخصات دوره" : "Course Details";
        break;
      case "class":
        icon = <Calendar className="w-5 h-5 text-purple-400" />;
        title = isFarsi ? "مشخصات کلاس" : "Class Details";
        break;
      case "invoice":
        icon = <Receipt className="w-5 h-5 text-pink-400" />;
        title = isFarsi ? "جزئیات فاکتور" : "Invoice Details";
        break;
      default:
        title = isFarsi ? "اطلاعات عمومی" : "Entity Details";
    }

    return (
      <DrawerHeader className="flex justify-between items-center bg-[var(--s1)] border-b border-[var(--b)] p-4">
        <div className="flex items-center gap-2">
          {icon}
          <DrawerTitle>{title}</DrawerTitle>
        </div>
        <DrawerClose className="p-1 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] border-none bg-transparent cursor-pointer">
          <X className="w-5 h-5" />
        </DrawerClose>
      </DrawerHeader>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-2">
          <Spinner size="md" />
          <span className="text-xs text-[var(--t3)]">{isFarsi ? "در حال دریافت اطلاعات..." : "Fetching records..."}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 text-center text-red-500 text-sm">
          {error}
        </div>
      );
    }

    if (!data) return null;

    if (entityType === "student" || entityType === "teacher" || entityType === "mentor") {
      const user = data.user_details || {};
      const name = user.full_name || user.username || "";
      const email = user.email || "";
      const roleName = data.role_name || entityType.toUpperCase();
      const statusLabel = data.is_active ? (isFarsi ? "فعال" : "Active") : (isFarsi ? "غیرفعال" : "Inactive");

      return (
        <div className="space-y-6 p-4">
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

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "مشخصات کلی" : "Summary Profile"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "نقش سازمانی" : "Org Role"}</span>
                <span className="font-bold text-[var(--t1)]">{roleName}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "وضعیت عضویت" : "Status"}</span>
                <span className={`font-bold ${data.is_active ? "text-[var(--green)]" : "text-[var(--t3)]"}`}>{statusLabel}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "نوع قرارداد" : "Contract Type"}</span>
                <span className="font-bold text-[var(--t1)] capitalize">{data.contract_type?.replace("_", " ") || "Full Time"}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "عضویت از" : "Joined"}</span>
                <span className="font-bold text-[var(--t1)]">{new Date(data.joined_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "ناوبری هوشمند و اکشن‌ها" : "Quick Actions"}</h4>
            
            {entityType === "student" && (
              <>
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
              </>
            )}

            {entityType === "teacher" && (
              <>
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
              </>
            )}
          </div>
        </div>
      );
    }

    if (entityType === "course") {
      return (
        <div className="space-y-6 p-4">
          <div className="border-b border-[var(--b)] pb-5 text-left">
            <span className="text-[10px] font-bold tracking-wider text-[var(--brand-text)] bg-[var(--brand)]/15 px-2.5 py-0.5 rounded-full uppercase">
              {data.code}
            </span>
            <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.title}</h3>
            <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">{data.description || (isFarsi ? "توضیحی برای این دوره ثبت نشده است." : "No description provided.")}</p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "خلاصه وضعیت" : "Course Summary"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] text-left">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "شهریه دوره" : "Tuition Fee"}</span>
                <span className="font-bold text-[var(--t1)] text-md">${parseFloat(data.price || "0").toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تاریخ ایجاد" : "Created Date"}</span>
                <span className="font-bold text-[var(--t1)]">{new Date(data.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "میانبرهای ناوبری" : "Linked Resource Navigation"}</h4>
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
    }

    if (entityType === "class") {
      return (
        <div className="space-y-6 p-4">
          <div className="border-b border-[var(--b)] pb-5 text-left">
            <span className="text-[10px] font-bold tracking-wider text-[var(--brand-text)] bg-[var(--brand)]/15 px-2.5 py-0.5 rounded-full uppercase">
              {data.course_code || "CLASS"}
            </span>
            <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.name}</h3>
            <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
              {isFarsi ? "دوره:" : "Course:"} <strong>{data.course_title}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "جزئیات کلاس" : "Class Schedule"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] text-left">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "مدرس اصلی" : "Lead Instructor"}</span>
                <span className="font-bold text-[var(--t1)]">{data.teacher_name || "Unassigned"}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "اتاق پیش‌فرض" : "Default Room"}</span>
                <span className="font-bold text-[var(--t1)]">{data.room || "Live Room"}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "کل جلسات" : "Total Sessions"}</span>
                <span className="font-bold text-[var(--t1)]">{data.session_count || 0}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تاریخ شروع" : "Start Date"}</span>
                <span className="font-bold text-[var(--t1)]">{data.start_date || "Not set"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}</h4>
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
    }

    if (entityType === "invoice") {
      const isPaid = data.status === "paid";
      return (
        <div className="space-y-6 p-4 text-left">
          <div className="border-b border-[var(--b)] pb-5">
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
              isPaid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {data.status}
            </span>
            <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.invoice_number || `#${data.id}`}</h3>
            <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
              {isFarsi ? "مبلغ فاکتور:" : "Invoice Amount:"} <strong className="text-md text-[var(--t1)]">${parseFloat(data.amount).toFixed(2)}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "اطلاعات فاکتور" : "Invoice Properties"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "دانشجو" : "Student"}</span>
                <span className="font-bold text-[var(--t1)]">{data.student_full_name || data.student_username}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "کلاس" : "Class"}</span>
                <span className="font-bold text-[var(--t1)] truncate block">{data.class_name || "—"}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "سررسید" : "Due Date"}</span>
                <span className="font-bold text-[var(--t1)]">{data.due_date || "Immediate"}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تاریخ پرداخت" : "Paid At"}</span>
                <span className="font-bold text-[var(--t1)]">{data.paid_at ? new Date(data.paid_at).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}</h4>
            <Link
              to={`/finance/ledger?invoice_id=${data.id}`}
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-pink-400" />
                <span>{isFarsi ? "مشاهده در دفتر مالی" : "Inspect in Ledger Dashboard"}</span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="end" panelClassName="w-80 max-w-[90vw] md:w-96">
      {renderHeader()}
      <DrawerBody className="bg-[var(--s1)]">
        {renderContent()}
      </DrawerBody>
    </Drawer>
  );
}
