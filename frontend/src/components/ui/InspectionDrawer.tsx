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
  ArrowRight,
  FileText
} from "lucide-react";

interface InspectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | "assignment" | null;
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

  const [localType, setLocalType] = useState<InspectionDrawerProps["entityType"]>(null);
  const [localId, setLocalId] = useState<InspectionDrawerProps["entityId"]>(null);
  const [history, setHistory] = useState<{ type: InspectionDrawerProps["entityType"]; id: InspectionDrawerProps["entityId"] }[]>([]);

  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);
  const [studentBalance, setStudentBalance] = useState<{ outstanding: number; pending_count: number } | null>(null);
  const [mentorStudents, setMentorStudents] = useState<any[]>([]);
  const [mentorClasses, setMentorClasses] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [missingAssignments, setMissingAssignments] = useState<number | null>(null);

  useEffect(() => {
    setLocalType(entityType);
    setLocalId(entityId);
    setHistory([]);
  }, [entityType, entityId, open]);

  const navigateTo = (type: InspectionDrawerProps["entityType"], id: InspectionDrawerProps["entityId"]) => {
    if (localType && localId) {
      setHistory((prev) => [...prev, { type: localType, id: localId }]);
    }
    setLocalType(type);
    setLocalId(id);
  };

  const navigateBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setLocalType(previous.type);
    setLocalId(previous.id);
  };

  useEffect(() => {
    if (!open || !localType || !localId) {
      setData(null);
      setError(null);
      setAttendanceRate(null);
      setMissingAssignments(null);
      return;
    }

    const fetchEntityDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        let endpoint = "";
        let match: any = null;
        if (localType === "student" || localType === "teacher" || localType === "mentor") {
          const res = await client.get("/auth/org-members/");
          const members = res.data || [];
          match = members.find(
            (m: any) => m.user === Number(localId) || m.id === Number(localId)
          );
          if (match) {
            setData(match);
          } else {
            endpoint = `/auth/org-members/${localId}/`;
          }
        } else if (localType === "course") {
          endpoint = `/auth/courses/${localId}/`;
        } else if (localType === "class") {
          endpoint = `/auth/classes/${localId}/`;
        } else if (localType === "session") {
          const res = await client.get("/auth/sessions/");
          const sessions = res.data || [];
          const sessionMatch = sessions.find((s: any) => s.id === Number(localId));
          if (sessionMatch) {
            setData(sessionMatch);
          } else {
            endpoint = `/auth/sessions/${localId}/`;
          }
        } else if (localType === "invoice") {
          endpoint = `/auth/invoices/${localId}/`;
        } else if (localType === "assignment") {
          endpoint = `/assessments/assignments/${localId}/`;
        }

        let fetchedData = match;
        if (endpoint) {
          const response = await client.get(endpoint);
          fetchedData = response.data;
          setData(fetchedData);
        }

        // Fetch extra info if needed
        if (localType === "student" && fetchedData) {
          setLoadingExtra(true);
          try {
            const userId = fetchedData.user_details?.id || fetchedData.user;
            if (userId) {
              const [enrollRes, invoiceRes, attendanceRes, assignmentsRes, submissionsRes, balanceRes] = await Promise.all([
                client.get("/auth/enrollments/?include_archived=true"),
                client.get(`/auth/invoices/?student_id=${userId}`),
                client.get(`/auth/attendance/?student=${userId}`),
                client.get("/assessments/assignments/"),
                client.get("/assessments/assignment-submissions/"),
                client.get(`/auth/invoices/balance/?student_id=${userId}`)
              ]);
              const enrolls = (enrollRes.data || []).filter((e: any) => e.student === userId);
              setStudentEnrollments(enrolls);
              setStudentInvoices(invoiceRes.data?.results || invoiceRes.data || []);
              setStudentBalance(balanceRes.data);

              // Calculate Attendance Rate
              const attList = attendanceRes.data || [];
              if (attList.length > 0) {
                const attended = attList.filter((att: any) => ["present", "late", "excused"].includes(att.status)).length;
                setAttendanceRate(Math.round((attended / attList.length) * 100));
              } else {
                setAttendanceRate(100);
              }

              // Calculate Missing Assignments
              const classIds = enrolls.map((e: any) => e.academy_class);
              const studentAssignments = (assignmentsRes.data || []).filter((a: any) => classIds.includes(a.academy_class));
              const studentSubmissions = (submissionsRes.data || []).filter((s: any) => Number(s.student) === Number(userId));
              const submittedIds = studentSubmissions.map((s: any) => s.assignment);
              const missingCount = studentAssignments.filter((a: any) => !submittedIds.includes(a.id)).length;
              setMissingAssignments(missingCount);
            }
          } catch (e) {
            console.error("Failed to load student extra info", e);
          } finally {
            setLoadingExtra(false);
          }
        } else if (localType === "mentor" && fetchedData) {
          setLoadingExtra(true);
          try {
            const userId = fetchedData.user_details?.id || fetchedData.user;
            if (userId) {
              const [classesRes, enrollRes] = await Promise.all([
                client.get("/auth/classes/?include_archived=true"),
                client.get("/auth/enrollments/?include_archived=true")
              ]);
              const mClasses = (classesRes.data || []).filter((c: any) => c.mentor === userId);
              const classIds = mClasses.map((c: any) => c.id);
              const mStudents = (enrollRes.data || []).filter((e: any) => classIds.includes(e.academy_class));
              setMentorClasses(mClasses);
              setMentorStudents(mStudents);
            }
          } catch (e) {
            console.error("Failed to load mentor extra info", e);
          } finally {
            setLoadingExtra(false);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(isFarsi ? "خطا در بارگذاری اطلاعات" : "Failed to load details.");
      } finally {
        setLoading(false);
      }
    };

    fetchEntityDetails();
  }, [open, localType, localId, isFarsi]);

  if (!open) return null;

  const renderHeader = () => {
    let icon = <User className="w-5 h-5 text-indigo-400" />;
    let title = "";

    switch (localType) {
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
      case "assignment":
        icon = <FileText className="w-5 h-5 text-yellow-400" />;
        title = isFarsi ? "جزئیات تکلیف" : "Assignment Details";
        break;
      default:
        title = isFarsi ? "اطلاعات عمومی" : "Entity Details";
    }

    return (
      <DrawerHeader className="flex justify-between items-center bg-[var(--s1)] border-b border-[var(--b)] p-4">
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={navigateBack}
              className="mr-2 p-1 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] border-none bg-transparent cursor-pointer flex items-center"
              title={isFarsi ? "بازگشت" : "Back"}
            >
              <ArrowRight className={`w-4 h-4 ${isFarsi ? "" : "rotate-180"}`} />
            </button>
          )}
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

    if (localType === "student" || localType === "teacher" || localType === "mentor") {
      const user = data.user_details || {};
      const name = user.full_name || user.username || "";
      const email = user.email || "";
      const roleName = data.role_name || localType.toUpperCase();
      const statusLabel = data.is_active ? (isFarsi ? "فعال" : "Active") : (isFarsi ? "غیرفعال" : "Inactive");
      const userId = user.id || data.user;

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

          {/* Academic KPIs */}
          {localType === "student" && (
            <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "وضعیت تحصیلی" : "Academic KPIs"}</h4>
              {loadingExtra ? (
                <div className="flex justify-center p-2"><Spinner size="sm" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
                  <div>
                    <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "نرخ حضور و غیاب" : "Attendance Rate"}</span>
                    <span className={`font-bold text-md ${attendanceRate !== null && attendanceRate < 75 ? "text-red-500" : "text-[var(--green)]"}`}>
                      {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تکالیف تحویل‌نشده" : "Missing Assignments"}</span>
                    <span className={`font-bold text-md ${missingAssignments !== null && missingAssignments > 0 ? "text-amber-500" : "text-[var(--green)]"}`}>
                      {missingAssignments !== null ? missingAssignments : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Enrolled Classes */}
          {localType === "student" && (
            <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "کلاس‌های فعال ثبت‌نامی" : "Active Enrolled Classes"}</h4>
              {loadingExtra ? (
                <div className="flex justify-center p-2"><Spinner size="sm" /></div>
              ) : studentEnrollments.length === 0 ? (
                <div className="text-xs text-[var(--t3)] italic bg-[var(--s2)] p-3 rounded-xl border border-[var(--b)]">{isFarsi ? "کلاس فعالی ثبت نشده است." : "No active classes enrolled."}</div>
              ) : (
                <div className="space-y-2">
                  {studentEnrollments.map((enroll: any) => (
                    <div key={enroll.id} className="flex justify-between items-center p-3 rounded-xl bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/20 transition-all text-xs">
                      <div className="flex flex-col min-w-0">
                        <button
                          onClick={() => navigateTo("class", enroll.academy_class)}
                          className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate"
                        >
                          {enroll.class_name || `#${enroll.academy_class}`}
                        </button>
                        <span className="text-[10px] text-[var(--t3)] mt-0.5">
                          {isFarsi ? "ثبت‌نام:" : "Enrolled:"} {new Date(enroll.enrolled_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        enroll.completion_status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                        enroll.completion_status === "dropped" ? "bg-red-500/10 text-red-400" :
                        "bg-indigo-500/10 text-indigo-400"
                      }`}>
                        {enroll.completion_status || "in_progress"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Outstanding Balance Info */}
          {localType === "student" && (
            <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "وضعیت مالی" : "Financial Balance"}</h4>
              {loadingExtra ? (
                <div className="flex justify-center p-2"><Spinner size="sm" /></div>
              ) : (
                (() => {
                  const outstandingInvoices = studentInvoices.filter(
                    (inv: any) => inv.status !== "paid" && inv.status !== "cancelled"
                  );
                  const totalOutstanding = studentBalance?.outstanding ?? 0;
                  const pendingCount = studentBalance?.pending_count ?? 0;

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
                        <div>
                          <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "کل بدهی معوق" : "Outstanding Bal."}</span>
                          <span className={`font-bold text-md ${totalOutstanding > 0 ? "text-amber-500" : "text-[var(--green)]"}`}>
                            ${totalOutstanding.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تعداد فاکتورهای معوق" : "Pending Invoices"}</span>
                          <span className="font-bold text-[var(--t1)]">{pendingCount}</span>
                        </div>
                      </div>

                      {pendingCount > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wide block">{isFarsi ? "فاکتورهای پرداخت نشده" : "Unpaid Invoices"}</span>
                          {outstandingInvoices.slice(0, 3).map((inv: any) => (
                            <div key={inv.id} className="flex justify-between items-center p-2.5 rounded-lg bg-[var(--s2)] border border-[var(--b)] text-xs">
                              <div className="flex flex-col">
                                <button
                                  onClick={() => navigateTo("invoice", inv.id)}
                                  className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
                                >
                                  {inv.invoice_number || `#${inv.id}`}
                                </button>
                                <span className="text-[10px] text-[var(--t3)] mt-0.5">{inv.class_name || (isFarsi ? "عمومی" : "General")}</span>
                              </div>
                              <span className="font-bold text-[var(--t1)]">${parseFloat(inv.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Mentored Students list */}
          {localType === "mentor" && (
            <div className="space-y-4 pt-4 border-t border-[var(--b)]/60 text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "دانش‌آموزان تحت منتورینگ" : "Mentored Students"}</h4>
              {loadingExtra ? (
                <div className="flex justify-center p-2"><Spinner size="sm" /></div>
              ) : mentorStudents.length === 0 ? (
                <div className="text-xs text-[var(--t3)] italic bg-[var(--s2)] p-3 rounded-xl border border-[var(--b)]">{isFarsi ? "کلاس یا دانش‌آموزی تحت منتورینگ یافت نشد." : "No mentored students found."}</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {mentorStudents.map((enroll: any) => (
                    <div key={enroll.id} className="flex justify-between items-center p-3 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-xs">
                      <div className="flex flex-col min-w-0">
                        <button
                          onClick={() => navigateTo("student", enroll.student)}
                          className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate"
                        >
                          {enroll.student_full_name || enroll.student_username || `#${enroll.student}`}
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
          )}

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "ناوبری هوشمند و اکشن‌ها" : "Quick Actions"}</h4>
            
            {localType === "student" && (
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
                  to={`/finance/ledger?action=issue_invoice&student_id=${userId}&student_name=${encodeURIComponent(name)}`}
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
              </>
            )}

            {localType === "teacher" && (
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

    if (localType === "course") {
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

    if (localType === "class") {
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
                  onClick={() => navigateTo("course", data.course)}
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "جزئیات کلاس" : "Class Schedule"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] text-left">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "مدرس اصلی" : "Lead Instructor"}</span>
                {data.teacher ? (
                  <button
                    onClick={() => navigateTo("teacher", data.teacher)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
                  >
                    {data.teacher_name || "Unassigned"}
                  </button>
                ) : (
                  <span className="font-bold text-[var(--t1)]">{data.teacher_name || "Unassigned"}</span>
                )}
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "منتور" : "Mentor"}</span>
                {data.mentor ? (
                  <button
                    onClick={() => navigateTo("mentor", data.mentor)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
                  >
                    {data.mentor_name || "Unassigned"}
                  </button>
                ) : (
                  <span className="font-bold text-[var(--t1)]">{data.mentor_name || "Unassigned"}</span>
                )}
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

    if (localType === "invoice") {
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
                {data.student ? (
                  <button
                    onClick={() => navigateTo("student", data.student)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
                  >
                    {data.student_full_name || data.student_username}
                  </button>
                ) : (
                  <span className="font-bold text-[var(--t1)]">{data.student_full_name || data.student_username}</span>
                )}
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "کلاس" : "Class"}</span>
                {data.academy_class ? (
                  <button
                    onClick={() => navigateTo("class", data.academy_class)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs truncate block w-full"
                  >
                    {data.class_name || "—"}
                  </button>
                ) : (
                  <span className="font-bold text-[var(--t1)] truncate block">{data.class_name || "—"}</span>
                )}
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

    if (localType === "assignment") {
      const isOverdue = data.due_date ? new Date(data.due_date) < new Date() : false;
      return (
        <div className="space-y-6 p-4 text-left">
          <div className="border-b border-[var(--b)] pb-5">
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${
              isOverdue ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {isOverdue ? (isFarsi ? "گذشته از سررسید" : "Overdue") : (isFarsi ? "فعال" : "Active")}
            </span>
            <h3 className="font-bold text-[var(--t1)] text-xl mt-3">{data.title}</h3>
            <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
              {data.description || (isFarsi ? "توضیحی برای این تکلیف ثبت نشده است." : "No description provided.")}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "مشخصات تکلیف" : "Assignment Properties"}</h4>
            <div className="grid grid-cols-2 gap-4 text-xs bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "کلاس" : "Class"}</span>
                {data.academy_class ? (
                  <button
                    onClick={() => navigateTo("class", data.academy_class)}
                    className="font-bold text-[var(--brand)] hover:underline bg-transparent border-none p-0 cursor-pointer text-left text-xs"
                  >
                    {data.class_name || `#${data.academy_class}`}
                  </button>
                ) : (
                  <span className="font-bold text-[var(--t1)]">—</span>
                )}
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تاریخ سررسید" : "Due Date"}</span>
                <span className="font-bold text-[var(--t1)]">{data.due_date ? new Date(data.due_date).toLocaleDateString() : (isFarsi ? "ندارد" : "None")}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تعداد تحویل‌ها" : "Submissions"}</span>
                <span className="font-bold text-[var(--t1)]">{data.submissions_count || 0}</span>
              </div>
              <div>
                <span className="block text-[var(--t3)] font-medium mb-1">{isFarsi ? "تصحیح شده" : "Graded"}</span>
                <span className="font-bold text-[var(--t1)]">{data.graded_count || 0}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--b)]/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--t3)]">{isFarsi ? "میانبرهای ناوبری" : "Linked Navigation"}</h4>
            <Link
              to={`/academic/assignments/${data.id}`}
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/35 text-xs text-[var(--t1)] no-underline font-semibold transition-all group"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{isFarsi ? "مشاهده جزئیات کامل تکلیف" : "View Full Assignment Details"}</span>
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
