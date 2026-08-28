import { getApiErrorData } from "@/lib/api/errors";
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { crmApi, type AcademyClass, type SimpleUser } from "../api/crm.api";
import { useSessions } from "../../sessions/hooks/useSessions";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { useAuthStore } from "../../auth/store/authStore";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { DatePicker } from "../../../components/forms/DatePicker";
import { DateTimePicker } from "../../../components/forms/DateTimePicker";

import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import BroadcastComposer from "./BroadcastComposer";
import ClassSessionsSubTable from "../../sessions/components/ClassSessionsSubTable";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";
import { assessmentsApi } from "../../assessments/api/assessments.api";
import { FileText, CheckCircle, Plus, Eye } from "lucide-react";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isFarsi = language === "fa";
  const isAdmin = hasPermission("can_manage_members");
  const isTeacher = hasPermission("can_teach_class");
  const id = parseInt(classId || "0");

  // ── Smart Inspection Drawer ─────────────────────────────────────
  const [inspectType, setInspectType] = useState<"student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | "assignment" | null>(null);
  const [inspectId, setInspectId] = useState<string | number | null>(null);

  // ── Queries ─────────────────────────────────────────────────────
  const { data: classes = [], isLoading: loadingClass } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const { data: liveSessions = [] } = useSessions(undefined, "live");
  const { data: classSessions = [] } = useSessions(id);

  const { data: classInvoicesResponse } = useQuery({
    queryKey: ["class-invoices", id],
    queryFn: () => crmApi.getInvoices({ class_id: id, page_size: 100 }),
  });
  const classInvoices = classInvoicesResponse?.results || [];

  const { data: classBalance } = useQuery({
    queryKey: ["class-balance", id],
    queryFn: () => crmApi.getInvoiceBalance({ class_id: id }),
  });

  const totalBilled = classBalance?.total_billed || 0;
  const outstandingBalance = classBalance?.outstanding || 0;

  const cls = classes.find((c) => c.id === id);
  const course = courses.find((c) => c.id === cls?.course);
  const classEnrollments = enrollments.filter((e) => e.academy_class === id && e.is_active);
  const isMyClass = cls?.teacher === user?.id;

  // ── Active live session for this class ──────────────────────────
  const liveSession = liveSessions.find((s) => s.academy_class === id);

  // ── Assignments & Homework Subsystem Queries ─────────────────────
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["assignments", id],
    queryFn: () => assessmentsApi.getAssignments({ class_id: id }),
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn: () => assessmentsApi.getAssignmentSubmissions({ class_id: id }),
  });

  // Class Occurrences (Automatic Recurrence Mode)
  const { data: occurrences = [] } = useQuery({
    queryKey: ["occurrences", id],
    queryFn: () => crmApi.getOccurrences({ class_id: id }),
    enabled: cls?.scheduling_mode === 'automatic',
  });

  const startOccurrenceMutation = useMutation({
    mutationFn: (occurrenceId: number) => crmApi.startOccurrence(occurrenceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["occurrences", id] });
      toast.success(isFarsi ? "جلسه کلاس با موفقیت شروع شد" : "Class session started successfully");
      navigate(`/rooms/${data.room_code}?token=${data.token}`);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در شروع جلسه کلاس" : "Failed to start class session"));
    }
  });

  const completeOccurrenceMutation = useMutation({
    mutationFn: (occurrenceId: number) => crmApi.completeOccurrence(occurrenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences", id] });
      toast.success(isFarsi ? "جلسه کلاس با موفقیت خاتمه یافت" : "Class session completed");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در خاتمه دادن جلسه" : "Failed to complete session"));
    }
  });

  const cancelOccurrenceMutation = useMutation({
    mutationFn: (occurrenceId: number) => crmApi.cancelOccurrence(occurrenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occurrences", id] });
      toast.success(isFarsi ? "جلسه کلاس با موفقیت لغو شد" : "Class session cancelled");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در لغو جلسه" : "Failed to cancel session"));
    }
  });

  // Create Assignment Form State
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", due_date: "", session: "" });
  const [assignmentAttachment, setAssignmentAttachment] = useState<File | null>(null);

  // Submit Homework Form State
  const [isSubmitHomeworkOpen, setIsSubmitHomeworkOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [submissionForm, setSubmissionForm] = useState({ submission_text: "" });
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  const createAssignmentMutation = useMutation({
    mutationFn: (formData: FormData) => assessmentsApi.createAssignment(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", id] });
      toast.success(isFarsi ? "تکلیف با موفقیت ایجاد شد" : "Assignment created successfully");
      setIsCreateAssignmentOpen(false);
      setAssignmentForm({ title: "", description: "", due_date: "", session: "" });
      setAssignmentAttachment(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در ایجاد تکلیف" : "Failed to create assignment"));
    }
  });

  const submitHomeworkMutation = useMutation({
    mutationFn: (formData: FormData) => assessmentsApi.createAssignmentSubmission(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] });
      toast.success(isFarsi ? "پاسخ تکلیف با موفقیت ارسال شد" : "Homework submitted successfully");
      setIsSubmitHomeworkOpen(false);
      setSubmissionForm({ submission_text: "" });
      setSubmissionFile(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در ارسال پاسخ" : "Failed to submit homework"));
    }
  });

  const handleCreateAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("academy_class", id.toString());
    formData.append("title", assignmentForm.title);
    formData.append("description", assignmentForm.description);
    if (assignmentForm.due_date) {
      formData.append("due_date", new Date(assignmentForm.due_date).toISOString());
    }
    if (assignmentForm.session) {
      if (cls?.scheduling_mode === 'automatic') {
        formData.append("occurrence", assignmentForm.session);
      } else {
        formData.append("session", assignmentForm.session);
      }
    }
    if (assignmentAttachment) {
      formData.append("attachment", assignmentAttachment);
    }
    createAssignmentMutation.mutate(formData);
  };

  const handleSubmitHomeworkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId) return;
    const formData = new FormData();
    formData.append("assignment", selectedAssignmentId.toString());
    formData.append("submission_text", submissionForm.submission_text);
    if (submissionFile) {
      formData.append("submission_file", submissionFile);
    }
    submitHomeworkMutation.mutate(formData);
  };

  // ── Edit Modal ───────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [classForm, setClassForm] = useState({
    name: "",
    course: "",
    teacher: "",
    mentor: "",
    start_date: "",
    end_date: "",
    room: "",
    scheduling_mode: "manual" as "manual" | "automatic",
    capacity_mode: "unlimited" as "unlimited" | "limited",
    max_students: ""
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherResults, setTeacherResults] = useState<SimpleUser[]>([]);
  const [mentorSearch, setMentorSearch] = useState("");
  const [mentorResults, setMentorResults] = useState<SimpleUser[]>([]);

  useEffect(() => {
    if (teacherSearch.length >= 2) {
      crmApi.searchUsers(teacherSearch, "teacher").then(setTeacherResults);
    }
  }, [teacherSearch]);

  useEffect(() => {
    if (mentorSearch.length >= 2) {
      crmApi.searchUsers(mentorSearch, "mentor").then(setMentorResults);
    }
  }, [mentorSearch]);

  const openEdit = () => {
    if (!cls) return;
    setClassForm({
      name: cls.name,
      course: cls.course.toString(),
      teacher: cls.teacher?.toString() || "",
      mentor: cls.mentor?.toString() || "",
      start_date: cls.start_date || "",
      end_date: cls.end_date || "",
      room: cls.room || "",
      scheduling_mode: cls.scheduling_mode || "manual",
      capacity_mode: cls.capacity_mode || "unlimited",
      max_students: cls.max_students?.toString() || "",
    });
    setTeacherSearch(cls.teacher_name || "");
    setTeacherResults([]);
    setMentorSearch(cls.mentor_name || "");
    setMentorResults([]);
    setIsEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AcademyClass>) => crmApi.updateClass(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "کلاس با موفقیت ویرایش شد" : "Class updated");
      setIsEditOpen(false);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در ویرایش" : "Failed to update class"));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "کلاس حذف شد" : "Class deleted");
      navigate("/academic/classes");
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در حذف" : "Failed to delete"));
    }
  });

  const startAutomaticClassMutation = useMutation({
    mutationFn: () => crmApi.startAutomaticClass(id),
    onSuccess: (data) => {
      toast.success(isFarsi ? "کلاس با موفقیت آغاز شد" : "Class started successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/room/${data.active_room_code}`);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || getApiErrorData(error)?.error || (isFarsi ? "خطا در شروع کلاس" : "Failed to start class"));
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: classForm.name,
      course: parseInt(classForm.course),
      teacher: classForm.teacher ? parseInt(classForm.teacher) : null,
      mentor: classForm.mentor ? parseInt(classForm.mentor) : null,
      start_date: classForm.start_date || null,
      end_date: classForm.end_date || null,
      room: classForm.room || null,
      scheduling_mode: classForm.scheduling_mode,
      capacity_mode: classForm.capacity_mode,
      max_students: classForm.capacity_mode === 'limited' ? parseInt(classForm.max_students) : null
    });
  };

  // ── Enroll Student ───────────────────────────────────────────────
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<SimpleUser[]>([]);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

  useEffect(() => {
    if (studentSearch.length >= 2) {
      crmApi.searchUsers(studentSearch, "student").then(setStudentResults);
    }
  }, [studentSearch]);

  const enrollMutation = useMutation({
    mutationFn: (studentId: number) => crmApi.createEnrollment({ academy_class: id, student: studentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "دانشجو ثبت‌نام شد" : "Student enrolled");
      setStudentSearch("");
      setStudentResults([]);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorData(error)?.detail || (isFarsi ? "خطا در ثبت‌نام" : "Failed to enroll"));
    }
  });

  const unenrollMutation = useMutation({
    mutationFn: crmApi.deleteEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success(isFarsi ? "ثبت‌نام لغو شد" : "Enrollment removed");
    }
  });

  // ── Broadcast ────────────────────────────────────────────────────
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  // ── Loading / Not Found ──────────────────────────────────────────
  if (loadingClass) {
    return (
      <AppShell title="...">
        <div className="flex justify-center p-16"><Spinner /></div>
      </AppShell>
    );
  }

  if (!cls) {
    return (
      <AppShell title={isFarsi ? "کلاس یافت نشد" : "Class Not Found"}>
        <div className="p-12 text-center">
          <div className="text-4xl mb-4">🏫</div>
          <p className="text-[var(--t3)] mb-4">{isFarsi ? "این کلاس وجود ندارد." : "This class does not exist."}</p>
          <Link to="/academic/classes"><Button variant="secondary">{isFarsi ? "بازگشت" : "Go Back"}</Button></Link>
        </div>
      </AppShell>
    );
  }

  const isLive = cls.latest_session?.status === "live";

  return (
    <AppShell title={cls.name}>
      <div className="flex flex-col gap-6">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
          <Link to="/academic/classes" className="hover:text-[var(--brand)] transition-colors">{isFarsi ? "کلاس‌ها" : "Classes"}</Link>
          <span>/</span>
          {course && (
            <>
              <Link to={`/academic/courses/${course.id}`} className="hover:text-[var(--brand)] transition-colors">{course.title}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-[var(--t1)] font-medium">{cls.name}</span>
        </div>

        {/* ── Header Card ── */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0 ${
                isLive ? "bg-[var(--green)]/15 text-[var(--green)]" : "bg-[var(--brand)]/10 text-[var(--brand)]"
              }`}>
                {isLive ? "🔴" : cls.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold text-[var(--t1)]">{cls.name}</h1>
                  {isLive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--green)]/15 text-[var(--green)] animate-pulse">
                      {isFarsi ? "زنده" : "LIVE"}
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--t2)]">
                  {course ? (
                    <Link to={`/academic/courses/${course.id}`} className="hover:text-[var(--brand)] transition-colors font-medium">
                      {course.title} <span className="font-mono text-[var(--t3)]">({course.code})</span>
                    </Link>
                  ) : <span className="text-[var(--t3)]">—</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-[var(--t3)]">
                  <span>
                    👤{" "}
                    {cls.teacher ? (
                      <button
                        onClick={() => {
                          setInspectType("teacher");
                          setInspectId(cls.teacher ?? null);
                        }}
                        className="bg-transparent border-none p-0 text-[var(--t3)] hover:text-[var(--brand)] hover:underline cursor-pointer font-medium text-[11px] align-baseline"
                      >
                        {cls.teacher_name || (isFarsi ? "بدون مدرس" : "No Teacher")}
                      </button>
                    ) : (
                      <span>{cls.teacher_name || (isFarsi ? "بدون مدرس" : "No Teacher")}</span>
                    )}
                  </span>
                  <span>
                    🤝{" "}
                    {cls.mentor ? (
                      <button
                        onClick={() => {
                          setInspectType("mentor");
                          setInspectId(cls.mentor ?? null);
                        }}
                        className="bg-transparent border-none p-0 text-[var(--t3)] hover:text-[var(--brand)] hover:underline cursor-pointer font-medium text-[11px] align-baseline"
                      >
                        {cls.mentor_name || (isFarsi ? "بدون منتور" : "No Mentor")}
                      </button>
                    ) : (
                      <span>{cls.mentor_name || (isFarsi ? "بدون منتور" : "No Mentor")}</span>
                    )}
                  </span>
                  {cls.room && <span>🚪 {cls.room}</span>}
                  {cls.start_date && <span>📅 {cls.start_date}{cls.end_date ? ` → ${cls.end_date}` : ""}</span>}
                  <span>🎓 {classEnrollments.length} {isFarsi ? "دانشجو" : "students"}</span>
                  <span>📖 {cls.session_count || 0} {isFarsi ? "جلسه" : "sessions"}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              {isLive && liveSession?.active_room_code && (
                <Link to={`/room/${liveSession.active_room_code}`}>
                  <Button>🔴 {isFarsi ? "ورود به کلاس زنده" : "Join Live Class"}</Button>
                </Link>
              )}
              {cls.scheduling_mode === 'automatic' && !isLive && (isAdmin || (isTeacher && isMyClass)) && (
                <Button
                  onClick={() => startAutomaticClassMutation.mutate()}
                  disabled={startAutomaticClassMutation.isPending}
                >
                  🚀 {startAutomaticClassMutation.isPending ? (isFarsi ? "در حال راه‌اندازی..." : "Starting...") : (isFarsi ? "شروع کلاس زنده" : "Start Live Class")}
                </Button>
              )}
              {(isAdmin || (isTeacher && isMyClass)) && (
                <Button variant="secondary" onClick={() => setIsBroadcastOpen(true)}>
                  {isFarsi ? "ارسال پیام" : "Broadcast"}
                </Button>
              )}
              {isAdmin && (
                <>
                  <Button size="sm" variant="secondary" onClick={openEdit}>{isFarsi ? "ویرایش" : "Edit"}</Button>
                  <button
                    onClick={() => {
                      if (confirm(isFarsi ? "حذف این کلاس؟" : "Delete this class?")) deleteMutation.mutate();
                    }}
                    className="text-xs bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer px-2"
                  >
                    {isFarsi ? "حذف" : "Delete"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Financial Summary Block ── */}
        {hasPermission("can_view_financials") && (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
              {isFarsi ? "خلاصه مالی کلاس" : "Class Financial Summary"}
            </h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-3 bg-[var(--s3)] rounded-xl border border-[var(--b)]">
                <div className="text-[10px] text-[var(--t3)] uppercase font-semibold mb-1">
                  {isFarsi ? "کل مبلغ صادر شده" : "Total Billed"}
                </div>
                <div className="text-xl font-bold text-[var(--t1)]">
                  ${totalBilled.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-[var(--s3)] rounded-xl border border-[var(--b)]">
                <div className="text-[10px] text-[var(--t3)] uppercase font-semibold mb-1">
                  {isFarsi ? "مطالبات معوق" : "Outstanding Balance"}
                </div>
                <div className="text-xl font-bold text-amber-500">
                  ${outstandingBalance.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Sessions & Assignments ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Sessions sub-table */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "برنامه جلسات" : "Session Schedule"}
                </span>
                {cls.scheduling_mode === 'manual' && (
                  <Link to="/academic/sessions" className="text-[10px] text-[var(--brand)] hover:underline">
                    {isFarsi ? "مشاهده همه جلسات" : "View All Sessions"} →
                  </Link>
                )}
              </div>
              
              {cls.scheduling_mode === 'automatic' ? (
                <div className="p-4 flex flex-col gap-4">
                  {/* Recurrence Rule Banner */}
                  <div className="p-4 bg-[var(--brand)]/10 text-[var(--t1)] border border-[var(--brand)]/20 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold mb-1">
                        {isFarsi ? "برنامه هفتگی کلاس (سیستم خودکار)" : "Weekly Schedule (Automatic)"}
                      </h4>
                      <p className="text-xs text-[var(--t2)] font-medium">
                        {isFarsi ? "برگزار می‌شود در: " : "Repeats on: "}
                        <span className="font-bold">
                          {cls.recurrence_weekdays?.map((d: string) => isFarsi ? {
                            monday: "دوشنبه", tuesday: "سه‌شنبه", wednesday: "چهارشنبه",
                            thursday: "پنج‌شنبه", friday: "جمعه", saturday: "شنبه", sunday: "یکشنبه"
                          }[d] : d.charAt(0).toUpperCase() + d.slice(1)).join("، ")}
                        </span>
                        {" "}
                        {isFarsi ? "ساعت: " : "at: "}
                        <span className="font-bold font-mono">{cls.recurrence_start_time || "—"}</span>
                        {" "}
                        {isFarsi ? `(مدت جلسه: ${cls.recurrence_duration_minutes} دقیقه)` : `(Duration: ${cls.recurrence_duration_minutes} mins)`}
                      </p>
                    </div>
                  </div>

                  {/* Next Occurrence Callout */}
                  {(() => {
                    const upcoming = occurrences.filter(
                      (occurrence) =>
                        occurrence.status === "scheduled" || occurrence.status === "live",
                    );
                    if (upcoming.length === 0) return null;
                    const next = upcoming[0];
                    const isNextLive = next.status === 'live';

                    return (
                      <div className="p-4 bg-[var(--s3)] border border-[var(--b)] rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase font-bold text-[var(--brand)] tracking-wider">
                              {isFarsi ? "جلسه بعدی" : "Next Occurrence"}
                            </span>
                            {isNextLive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--green)]/15 text-[var(--green)] animate-pulse">
                                {isFarsi ? "زنده" : "LIVE"}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-[var(--t1)]">
                            {new Date(next.scheduled_start).toLocaleString(isFarsi ? "fa-IR" : "en-US")}
                          </h4>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          {isNextLive ? (
                            <Link to={`/room/${next.room_code}`} className="w-full md:w-auto">
                              <Button className="w-full md:w-auto text-xs py-1.5">
                                🔴 {isFarsi ? "ورود به کلاس" : "Join Session"}
                              </Button>
                            </Link>
                          ) : (
                            (isAdmin || (isTeacher && isMyClass)) && (
                              <Button 
                                onClick={() => startOccurrenceMutation.mutate(next.id)}
                                disabled={startOccurrenceMutation.isPending}
                                className="w-full md:w-auto text-xs py-1.5"
                              >
                                🚀 {isFarsi ? "شروع کلاس زنده" : "Start Live Class"}
                              </Button>
                            )
                          )}
                          {!isNextLive && (isAdmin || (isTeacher && isMyClass)) && (
                            <Button 
                              variant="secondary"
                              onClick={() => {
                                if (confirm(isFarsi ? "آیا مایل به لغو این جلسه هستید؟" : "Are you sure you want to cancel this occurrence?")) {
                                  cancelOccurrenceMutation.mutate(next.id);
                                }
                              }}
                              disabled={cancelOccurrenceMutation.isPending}
                              className="text-xs py-1.5 border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)]/10"
                            >
                              ❌ {isFarsi ? "لغو" : "Cancel"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Occurrences List Table */}
                  <div className="overflow-x-auto border border-[var(--b)] rounded-xl bg-[var(--s2)]">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--b)] text-[var(--t3)] uppercase text-left bg-[var(--s3)] font-semibold">
                          <th className="p-3">{isFarsi ? "جلسه" : "Session Date"}</th>
                          <th className="p-3">{isFarsi ? "زمان" : "Time"}</th>
                          <th className="p-3">{isFarsi ? "وضعیت" : "Status"}</th>
                          <th className="p-3">{isFarsi ? "حاضرین" : "Attendance"}</th>
                          <th className="p-3 text-right">{isFarsi ? "اقدامات" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {occurrences.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-[var(--t3)]">
                              {isFarsi ? "هیچ جلسه‌ای تولید نشده است" : "No occurrences generated."}
                            </td>
                          </tr>
                        ) : (
                          occurrences.map((o) => (
                            <tr key={o.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors">
                              <td className="p-3 font-semibold text-[var(--t1)]">
                                {new Date(o.scheduled_start).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                              </td>
                              <td className="p-3 font-mono text-[var(--t2)]">
                                {new Date(o.scheduled_start).toLocaleTimeString(isFarsi ? "fa-IR" : "en-US", { hour: '2-digit', minute: '2-digit' })}
                                {" → "}
                                {new Date(o.scheduled_end).toLocaleTimeString(isFarsi ? "fa-IR" : "en-US", { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  o.status === 'live' ? "bg-[var(--green)]/15 text-[var(--green)] animate-pulse" :
                                  o.status === 'completed' ? "bg-[var(--brand)]/10 text-[var(--brand)]" :
                                  o.status === 'cancelled' ? "bg-[var(--red)]/10 text-[var(--red)]" :
                                  "bg-[var(--s3)] text-[var(--t3)] border border-[var(--b)]"
                                }`}>
                                  {isFarsi ? ({
                                    scheduled: "برنامه‌ریزی شده", live: "زنده", completed: "خاتمه یافته", cancelled: "لغو شده"
                                  } as Record<string, string>)[o.status] || o.status : o.status}
                                </span>
                              </td>
                              <td className="p-3 text-[var(--t3)]">
                                📊 {o.attendance_count || 0} {isFarsi ? "نفر" : "students"}
                              </td>
                              <td className="p-3 text-right flex items-center justify-end gap-1">
                                {o.status === 'live' ? (
                                  <>
                                    <Link to={`/room/${o.room_code}`}>
                                      <button className="text-[10px] font-semibold text-[var(--green)] hover:underline bg-transparent border-none cursor-pointer">
                                        {isFarsi ? "ورود" : "Join"}
                                      </button>
                                    </Link>
                                    {(isAdmin || (isTeacher && isMyClass)) && (
                                      <button
                                        onClick={() => completeOccurrenceMutation.mutate(o.id)}
                                        className="text-[10px] font-semibold text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer"
                                      >
                                        {isFarsi ? "خاتمه" : "Complete"}
                                      </button>
                                    )}
                                  </>
                                ) : o.status === 'scheduled' && (isAdmin || (isTeacher && isMyClass)) ? (
                                  <>
                                    <button 
                                      onClick={() => startOccurrenceMutation.mutate(o.id)}
                                      className="text-[10px] font-semibold text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer mr-2"
                                    >
                                      {isFarsi ? "شروع" : "Start"}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (confirm(isFarsi ? "لغو جلسه؟" : "Cancel session?")) cancelOccurrenceMutation.mutate(o.id);
                                      }}
                                      className="text-[10px] font-semibold text-[var(--red)] hover:underline bg-transparent border-none cursor-pointer"
                                    >
                                      {isFarsi ? "لغو" : "Cancel"}
                                    </button>
                                  </>
                                ) : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <ClassSessionsSubTable cls={cls} language={language} />
              )}
            </div>

            {/* Assignments Panel */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "تکالیف و کار خانگی" : "Assignments & Homework"}
                </span>
                {(isAdmin || (isTeacher && isMyClass)) && (
                  <button
                    onClick={() => setIsCreateAssignmentOpen(true)}
                    className="text-[10px] text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isFarsi ? "ایجاد تکلیف جدید" : "Create Assignment"}
                  </button>
                )}
              </div>

              {loadingAssignments ? (
                <div className="p-6 flex justify-center"><Spinner /></div>
              ) : assignments.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-2xl mb-2">📝</div>
                  <p className="text-xs text-[var(--t3)]">
                    {isFarsi ? "هیچ تکلیفی برای این کلاس ثبت نشده است." : "No assignments registered for this class."}
                  </p>
                  {(isAdmin || (isTeacher && isMyClass)) && (
                    <button
                      onClick={() => setIsCreateAssignmentOpen(true)}
                      className="text-[10px] text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer mt-2"
                    >
                      {isFarsi ? "+ افزودن تکلیف" : "+ Add Assignment"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[var(--b)]">
                  {assignments.map((assignment) => {
                    const submission = mySubmissions.find((s) => s.assignment === assignment.id);
                    const isGraded = submission?.status === "graded";
                    const isSubmitted = submission?.status === "submitted";

                    return (
                      <div key={assignment.id} className="p-4 hover:bg-[var(--s3)] transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <Link to={`/academic/assignments/${assignment.id}`} className="text-sm font-semibold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline block truncate">
                              {assignment.title}
                            </Link>
                            <p className="text-xs text-[var(--t3)] truncate max-w-md mt-0.5">{assignment.description}</p>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-[var(--t3)] items-center">
                              {assignment.due_date && (
                                <span className="flex items-center gap-1">
                                  📅 {isFarsi ? "مهلت:" : "Due:"} {new Date(assignment.due_date).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                                </span>
                              )}
                              {assignment.attachment && (
                                <a href={assignment.attachment} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline no-underline font-semibold flex items-center gap-1">
                                  📎 {isFarsi ? "پیوست درس" : "Attachment"}
                                </a>
                              )}
                              {(isAdmin || (isTeacher && isMyClass)) && (
                                <span className="px-2 py-0.5 rounded-full bg-[var(--s3)] border border-[var(--b)] font-medium">
                                  📊 {assignment.submissions_count || 0} {isFarsi ? "ارسال شده" : "submissions"}
                                  {assignment.graded_count !== undefined && ` (${assignment.graded_count} ${isFarsi ? "نمره‌دهی شده" : "graded"})`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                          {(!isAdmin && !(isTeacher && isMyClass)) && (
                            <>
                              {isGraded ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--green)]/15 text-[var(--green)]">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {isFarsi ? `نمره: ${submission?.grade} از ۱۰۰` : `Grade: ${submission?.grade}/100`}
                                </span>
                              ) : isSubmitted ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--cyan)]/15 text-[var(--cyan)]">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {isFarsi ? "ارسال شده" : "Submitted"}
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAssignmentId(assignment.id);
                                    setIsSubmitHomeworkOpen(true);
                                  }}
                                >
                                  {isFarsi ? "ارسال پاسخ" : "Submit Homework"}
                                </Button>
                              )}
                            </>
                          )}
                          <Link to={`/academic/assignments/${assignment.id}`}>
                            <Button variant="secondary" size="sm" className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {isFarsi ? "مشاهده" : "View"}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Enrolled Students ── */}
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                {isFarsi ? "دانشجویان" : "Enrolled Students"}
                <span className="ml-2 text-[var(--brand)]">({classEnrollments.length})</span>
              </span>
              {isAdmin && (
                <button
                  onClick={() => setIsEnrollOpen(true)}
                  className="text-[10px] text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer"
                >
                  {isFarsi ? "+ ثبت‌نام" : "+ Enroll"}
                </button>
              )}
            </div>

            {loadingEnrollments ? (
              <div className="p-6 flex justify-center"><Spinner /></div>
            ) : classEnrollments.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">🎓</div>
                <p className="text-xs text-[var(--t3)]">
                  {isFarsi ? "دانشجویی ثبت‌نام نکرده" : "No students enrolled"}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setIsEnrollOpen(true)}
                    className="text-[10px] text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer mt-2"
                  >
                    {isFarsi ? "+ افزودن دانشجو" : "+ Add Student"}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[var(--b)] max-h-[360px] overflow-y-auto">
                {classEnrollments.map((e) => {
                  const studentInvoices = classInvoices.filter((inv) => inv.student === e.student);
                  const hasUnpaidOrOverdue = studentInvoices.some(
                    (inv) => inv.status === "unpaid" || inv.status === "overdue" || inv.status === "partial"
                  );

                  return (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--s3)] transition-colors">
                      <div
                        className={`flex items-center gap-2 min-w-0 group ${(isAdmin || isTeacher || e.student === user?.id) ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (isAdmin || isTeacher || e.student === user?.id) {
                            setInspectType("student");
                            setInspectId(e.student);
                          }
                        }}
                      >
                        <div className="w-7 h-7 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[10px] font-bold flex-shrink-0 group-hover:border-[var(--brand)] transition-colors">
                          {(e.student_full_name || e.student_username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--t1)] truncate group-hover:text-[var(--brand)] transition-colors flex items-center gap-1.5">
                            <span>{e.student_full_name || e.student_username}</span>
                            {hasUnpaidOrOverdue && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[var(--red)] flex-shrink-0"
                                title={isFarsi ? "فاکتور پرداخت نشده یا معوق" : "Unpaid or Overdue Invoice"}
                              />
                            )}
                          </div>
                          <div className="text-[9px] text-[var(--t3)] truncate">@{e.student_username}</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(isFarsi ? `لغو ثبت‌نام ${e.student_full_name}؟` : `Unenroll ${e.student_full_name}?`)) {
                              unenrollMutation.mutate(e.id);
                            }
                          }}
                          className="text-[9px] bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer flex-shrink-0 ml-2"
                        >
                          {isFarsi ? "حذف" : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            {
              label: isFarsi ? "فاکتورهای کلاس" : "Class Invoices",
              desc: isFarsi ? "مشاهده فاکتورهای این کلاس" : "Tuition invoices for this class",
              icon: "💰",
              to: `/finance/ledger?class_id=${id}`,
              visible: hasPermission("can_view_financials"),
            },
            {
              label: isFarsi ? "حضور و غیاب کلاس" : "Class Attendance",
              desc: isFarsi ? "مشاهده لیست حضور و غیاب کلاس" : "Attendance matrix for this class",
              icon: "📋",
              to: `/academic/attendance?class_id=${id}`,
              visible: hasPermission("can_view_attendance"),
            },
            {
              label: isFarsi ? "اعضای سازمان" : "Org Members",
              desc: isFarsi ? "مدیریت اعضا و نقش‌ها" : "Manage members & roles",
              icon: "👥",
              to: `/crm/members`,
              visible: hasPermission("can_manage_members") || hasPermission("can_teach_class"),
            },
            {
              label: isFarsi ? "دوره مرتبط" : "Parent Course",
              desc: course ? course.title : (isFarsi ? "مشاهده دوره" : "View course"),
              icon: "📚",
              to: course ? `/academic/courses/${course.id}` : "/academic/courses",
              visible: true,
            },
          ].filter(link => link.visible).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 bg-[var(--s2)] border border-[var(--b)] rounded-xl p-4 hover:border-[var(--brand)]/40 hover:bg-[var(--s3)] transition-all no-underline group"
            >
              <span className="text-2xl">{link.icon}</span>
              <div>
                <div className="text-sm font-semibold text-[var(--t1)] group-hover:text-[var(--brand)] transition-colors">{link.label}</div>
                <div className="text-[10px] text-[var(--t3)]">{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Edit Class Modal ── */}
      <Modal open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "ویرایش کلاس" : "Edit Class"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "نام کلاس" : "Class Name"}
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">{isFarsi ? "دوره آموزشی" : "Course"}</label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={classForm.course}
                onChange={(e) => setClassForm({ ...classForm, course: e.target.value })}
                required
              >
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.code})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">{isFarsi ? "جستجوی مدرس" : "Teacher"}</label>
              <Input
                value={teacherSearch}
                onChange={(e) => { setTeacherSearch(e.target.value); if (e.target.value.length < 2) setTeacherResults([]); if (!e.target.value) setClassForm({ ...classForm, teacher: "" }); }}
                placeholder={isFarsi ? "نام مدرس..." : "Search teacher..."}
              />
              {teacherResults.length > 0 && (
                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto flex flex-col gap-1">
                  {teacherResults.map((u) => (
                    <button key={u.id} type="button"
                      onClick={() => { setClassForm({ ...classForm, teacher: u.id.toString() }); setTeacherSearch(u.full_name || u.username); setTeacherResults([]); }}
                      className="w-full text-start p-1.5 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                    >
                      {u.full_name} ({u.username})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">{isFarsi ? "جستجوی منتور" : "Mentor"}</label>
              <Input
                value={mentorSearch}
                onChange={(e) => { setMentorSearch(e.target.value); if (e.target.value.length < 2) setMentorResults([]); if (!e.target.value) setClassForm({ ...classForm, mentor: "" }); }}
                placeholder={isFarsi ? "نام منتور..." : "Search mentor..."}
              />
              {mentorResults.length > 0 && (
                <div className="bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[120px] overflow-y-auto flex flex-col gap-1">
                  {mentorResults.map((u) => (
                    <button key={u.id} type="button"
                      onClick={() => { setClassForm({ ...classForm, mentor: u.id.toString() }); setMentorSearch(u.full_name || u.username); setMentorResults([]); }}
                      className="w-full text-start p-1.5 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                    >
                      {u.full_name} ({u.username})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker label={isFarsi ? "تاریخ شروع" : "Start Date"} value={classForm.start_date || undefined} onChange={(val) => setClassForm({ ...classForm, start_date: val })} />
              <DatePicker label={isFarsi ? "تاریخ پایان" : "End Date"} value={classForm.end_date || undefined} onChange={(val) => setClassForm({ ...classForm, end_date: val })} />
            </div>

            <Input label={isFarsi ? "اتاق" : "Room"} value={classForm.room} onChange={(e) => setClassForm({ ...classForm, room: e.target.value })} placeholder="e.g. Room 302" />

            {/* Scheduling Mode Selection */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "نوع برنامه‌ریزی جلسات" : "Scheduling Mode"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClassForm({ ...classForm, scheduling_mode: 'manual' })}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    classForm.scheduling_mode === 'manual'
                      ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                      : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                  }`}
                >
                  {isFarsi ? "جلسات دستی" : "Manual Sessions"}
                </button>
                <button
                  type="button"
                  onClick={() => setClassForm({ ...classForm, scheduling_mode: 'automatic' })}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    classForm.scheduling_mode === 'automatic'
                      ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                      : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                  }`}
                >
                  {isFarsi ? "کلاس اتوماتیک" : "Automatic Continuous"}
                </button>
              </div>
            </div>

            {/* Enrollment Capacity Mode */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "ظرفیت ثبت‌نام" : "Enrollment Capacity"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClassForm({ ...classForm, capacity_mode: 'unlimited' })}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    classForm.capacity_mode === 'unlimited'
                      ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                      : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                  }`}
                >
                  {isFarsi ? "نامحدود" : "Unlimited"}
                </button>
                <button
                  type="button"
                  onClick={() => setClassForm({ ...classForm, capacity_mode: 'limited' })}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    classForm.capacity_mode === 'limited'
                      ? "bg-[var(--brand)] text-[var(--brand-text)] border-[var(--brand)] shadow-sm"
                      : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:border-[var(--brand)]"
                  }`}
                >
                  {isFarsi ? "محدود" : "Limited"}
                </button>
              </div>
            </div>

            {/* Maximum Students (Only when limited capacity) */}
            {classForm.capacity_mode === 'limited' && (
              <Input
                label={isFarsi ? "حداکثر تعداد دانشجویان" : "Maximum Students"}
                type="number"
                min="1"
                value={classForm.max_students}
                onChange={(e) => setClassForm({ ...classForm, max_students: e.target.value })}
                placeholder="e.g. 20"
                required
              />
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>{isFarsi ? "انصراف" : "Cancel"}</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (isFarsi ? "در حال ذخیره..." : "Saving...") : (isFarsi ? "ذخیره" : "Save")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ── Enroll Student Modal ── */}
      <Modal open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? `ثبت‌نام دانشجو — ${cls.name}` : `Enroll Student — ${cls.name}`}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "جستجوی دانشجو" : "Search Student"}
              </label>
              <Input
                value={studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); if (e.target.value.length < 2) setStudentResults([]); }}
                placeholder={isFarsi ? "نام یا نام کاربری دانشجو..." : "Search student by name..."}
              />
              {studentResults.length > 0 && (
                <div className="absolute top-[100%] left-0 right-0 z-50 bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[150px] overflow-y-auto mt-1 shadow-lg flex flex-col gap-1">
                  {studentResults.map((u) => {
                    const already = classEnrollments.some((e) => e.student === u.id);
                    return (
                      <button key={u.id} type="button" disabled={already}
                        onClick={() => enrollMutation.mutate(u.id)}
                        className="w-full text-start p-2 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer flex justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{u.full_name} ({u.username})</span>
                        {already && <span className="text-[9px] text-[var(--t3)]">{isFarsi ? "قبلاً ثبت‌نام شده" : "Already enrolled"}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                {isFarsi ? "دانشجویان فعلی" : "Current Students"} ({classEnrollments.length})
              </span>
              <div className="border border-[var(--b)] rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                {classEnrollments.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--t3)]">{isFarsi ? "هیچ دانشجویی وجود ندارد" : "No students yet"}</div>
                ) : (
                  classEnrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2 border-b border-[var(--b)] last:border-0 hover:bg-[var(--s3)] text-xs">
                      <span className="text-[var(--t1)]">{e.student_full_name || e.student_username}</span>
                      <button
                        onClick={() => { if (confirm(isFarsi ? "لغو ثبت‌نام؟" : "Remove enrollment?")) unenrollMutation.mutate(e.id); }}
                        className="text-[9px] bg-transparent text-[var(--red)] hover:underline border-none cursor-pointer"
                      >
                        {isFarsi ? "حذف" : "Remove"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIsEnrollOpen(false)}>{isFarsi ? "بستن" : "Close"}</Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* ── Create Assignment Modal ── */}
      <Modal open={isCreateAssignmentOpen} onOpenChange={setIsCreateAssignmentOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "ایجاد تکلیف جدید" : "Create New Assignment"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleCreateAssignmentSubmit} className="flex flex-col gap-4">
            <Input
              label={isFarsi ? "عنوان تکلیف" : "Assignment Title"}
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "توضیحات تکلیف" : "Description"}
              </label>
              <textarea
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[100px]"
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                placeholder={isFarsi ? "شرح تسک و انتظارات..." : "Provide assignment details..."}
                required
              />
            </div>
            <DateTimePicker
              label={isFarsi ? "مهلت ارسال (دلاین)" : "Due Date & Time"}
              value={assignmentForm.due_date || undefined}
              onChange={(val) => setAssignmentForm({ ...assignmentForm, due_date: val })}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "جلسه مرتبط (اختیاری)" : "Link to Session (Optional)"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={assignmentForm.session}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, session: e.target.value })}
              >
                <option value="">{isFarsi ? "تکلیف کلی کلاس (بدون جلسه خاص)" : "Class Homework (No specific session)"}</option>
                {cls?.scheduling_mode === 'automatic' ? (
                  occurrences.map((o) => (
                    <option key={o.id} value={o.id}>
                      Session - {new Date(o.scheduled_start).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')} ({new Date(o.scheduled_start).toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })})
                    </option>
                  ))
                ) : (
                  classSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({new Date(s.scheduled_start || s.created_at).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "فایل پیوست" : "Attachment (File)"}
              </label>
              <input
                type="file"
                className="text-xs text-[var(--t3)]"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"))) {
                    toast.error(isFarsi ? "فایل‌های SVG مجاز نیستند" : "SVG files are not allowed");
                    e.target.value = "";
                    setAssignmentAttachment(null);
                    return;
                  }
                  setAssignmentAttachment(file);
                }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsCreateAssignmentOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={createAssignmentMutation.isPending}>
                {createAssignmentMutation.isPending ? (isFarsi ? "در حال ایجاد..." : "Creating...") : (isFarsi ? "ایجاد" : "Create")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ── Submit Homework Modal ── */}
      <Modal open={isSubmitHomeworkOpen} onOpenChange={setIsSubmitHomeworkOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "ارسال پاسخ تکلیف" : "Submit Assignment"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmitHomeworkSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "توضیحات پاسخ (اختیاری)" : "Submission Notes (Optional)"}
              </label>
              <textarea
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[100px]"
                value={submissionForm.submission_text}
                onChange={(e) => setSubmissionForm({ ...submissionForm, submission_text: e.target.value })}
                placeholder={isFarsi ? "توضیحات خود را بنویسید..." : "Write any details or text answer..."}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "فایل پاسخ" : "Submission File"}
              </label>
              <input
                type="file"
                className="text-xs text-[var(--t3)]"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"))) {
                    toast.error(isFarsi ? "فایل‌های SVG مجاز نیستند" : "SVG files are not allowed");
                    e.target.value = "";
                    setSubmissionFile(null);
                    return;
                  }
                  setSubmissionFile(file);
                }}
                required
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsSubmitHomeworkOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitHomeworkMutation.isPending}>
                {submitHomeworkMutation.isPending ? (isFarsi ? "در حال ارسال..." : "Submitting...") : (isFarsi ? "ارسال" : "Submit")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* ── Broadcast Modal ── */}
      {isBroadcastOpen && (
        <BroadcastComposer
          classId={cls.id}
          className={cls.name}
          isFarsi={isFarsi}
          onClose={() => setIsBroadcastOpen(false)}
        />
      )}

      <InspectionDrawer
        open={!!inspectType}
        onOpenChange={(open) => {
          if (!open) {
            setInspectType(null);
            setInspectId(null);
          }
        }}
        entityType={inspectType}
        entityId={inspectId}
      />
    </AppShell>
  );
}
