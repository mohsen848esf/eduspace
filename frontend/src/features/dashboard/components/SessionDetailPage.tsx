import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import recordingsApi from "../../recordings/api/recordings.api";
import {
  useSession,
  useSessionAttendance,
  useUpdateAttendance,
  useStartSession,
  useCompleteSession,
  useCancelSession,
} from "../../sessions/hooks";
import { crmApi } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { useLocale } from "../../../i18n/useLocale";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";
import {
  Calendar,
  User,
  Clock,
  Video,
  ArrowLeft,
  AlertCircle,
  Search,
  Check,
  Percent
} from "lucide-react";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const id = parseInt(sessionId || "0");
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const navigate = useNavigate();
  const { hasPermission } = useOrgPermission();
  const canStartCompleteCancel = hasPermission("can_teach_class") || hasPermission("can_manage_sessions");

  // Inspection Drawer state
  const [inspectType, setInspectType] = useState<"student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | null>(null);
  const [inspectId, setInspectId] = useState<string | number | null>(null);

  // Student Search/Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [studentNotes, setStudentNotes] = useState<Record<number, string>>({});

  // Queries
  const { data: session, isLoading: loadingSession } = useSession(id);
  const { data: attendance = [], isLoading: loadingAttendance } = useSessionAttendance(id);
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const { data: recordingsData } = useQuery({
    queryKey: ["session-recordings", session?.active_room_code],
    queryFn: () => recordingsApi.list({ room_code: session?.active_room_code || undefined }),
    enabled: !!session?.active_room_code,
  });
  const sessionRecording = recordingsData?.results?.find(r => r.room_code === session?.active_room_code);

  // Mutations & hooks
  const { updateSingle, updateBulk } = useUpdateAttendance(id);
  const startSessionMutation = useStartSession();
  const completeSessionMutation = useCompleteSession();
  const cancelSessionMutation = useCancelSession();

  if (loadingSession || loadingEnrollments || loadingAttendance) {
    return (
      <AppShell title={isFarsi ? "جزئیات جلسه" : "Session Details"}>
        <div className="flex justify-center p-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell title={isFarsi ? "جلسه یافت نشد" : "Session Not Found"}>
        <div className="flex flex-col items-center justify-center p-16 gap-4 text-[var(--t3)]">
          <AlertCircle className="w-12 h-12 text-[var(--red)]" />
          <span>{isFarsi ? "جلسه مورد نظر پیدا نشد." : "The requested session could not be found."}</span>
          <Button onClick={() => navigate("/academic/sessions")}>
            {isFarsi ? "بازگشت به لیست جلسات" : "Back to Sessions"}
          </Button>
        </div>
      </AppShell>
    );
  }

  const classId = session.academy_class;
  const classEnrollments = enrollments.filter(
    (e) => e.academy_class === classId && e.is_active
  );

  // Compile active students list merging enrollment and attendance status
  const studentsList = classEnrollments.map((enroll) => {
    const record = attendance.find((a) => a.student === enroll.student);
    return {
      student_id: enroll.student,
      full_name: enroll.student_full_name || enroll.student_username || "—",
      username: enroll.student_username || "",
      status: record?.status || null,
      note: record?.note || "",
      joined_at: record?.joined_at || null,
      left_at: record?.left_at || null,
      attendance_id: record?.id || null,
    };
  });

  // Filter students based on search and status filters
  const filteredStudents = studentsList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "unrecorded" && !s.status) ||
      s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats calculation
  const totalEnrolled = classEnrollments.length;
  const presentCount = studentsList.filter((s) => s.status === "present").length;
  const lateCount = studentsList.filter((s) => s.status === "late").length;
  const absentCount = studentsList.filter((s) => s.status === "absent").length;
  const excusedCount = studentsList.filter((s) => s.status === "excused").length;
  const recordedCount = studentsList.filter((s) => s.status !== null).length;

  const attendanceRate =
    totalEnrolled - excusedCount > 0
      ? ((presentCount + lateCount) / (totalEnrolled - excusedCount)) * 100
      : 100;

  const handleStart = () => {
    startSessionMutation.mutate(id, {
      onSuccess: (data) => {
        toast.success(isFarsi ? "کلاس با موفقیت آغاز شد" : "Session started successfully");
        if (data.active_room_code) {
          navigate(`/room/${data.active_room_code}`);
        }
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || (isFarsi ? "خطا در شروع کلاس" : "Failed to start session"));
      },
    });
  };

  const handleComplete = () => {
    if (confirm(isFarsi ? "آیا از اتمام کلاس مطمئن هستید؟" : "Are you sure you want to complete this session?")) {
      completeSessionMutation.mutate(id, {
        onSuccess: () => {
          toast.success(isFarsi ? "کلاس پایان یافت" : "Session completed successfully");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || (isFarsi ? "خطا در ثبت پایان کلاس" : "Failed to complete session"));
        },
      });
    }
  };

  const handleCancel = () => {
    if (confirm(isFarsi ? "آیا از لغو این جلسه مطمئن هستید؟" : "Are you sure you want to cancel this session?")) {
      cancelSessionMutation.mutate(id, {
        onSuccess: () => {
          toast.success(isFarsi ? "جلسه لغو شد" : "Session cancelled successfully");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || (isFarsi ? "خطا در لغو جلسه" : "Failed to cancel session"));
        },
      });
    }
  };

  const handleStatusChange = (studentId: number, newStatus: string) => {
    const currentNote = studentNotes[studentId] ?? studentsList.find(s => s.student_id === studentId)?.note ?? "";
    updateSingle.mutate(
      { studentId, status: newStatus, note: currentNote },
      {
        onSuccess: () => {
          toast.success(isFarsi ? "وضعیت حضور ثبت شد" : "Attendance status updated");
        },
        onError: () => {
          toast.error(isFarsi ? "خطا در ثبت وضعیت حضور" : "Failed to update attendance status");
        },
      }
    );
  };

  const handleNoteSave = (studentId: number) => {
    const note = studentNotes[studentId] ?? "";
    const currentStatus = studentsList.find(s => s.student_id === studentId)?.status || "absent";
    updateSingle.mutate(
      { studentId, status: currentStatus, note },
      {
        onSuccess: () => {
          toast.success(isFarsi ? "یادداشت ذخیره شد" : "Note saved successfully");
        },
        onError: () => {
          toast.error(isFarsi ? "خطا در ذخیره یادداشت" : "Failed to save note");
        },
      }
    );
  };

  const handleBulkMark = (status: string) => {
    const records = classEnrollments.map((e) => ({
      student_id: e.student,
      status,
      note: studentNotes[e.student] ?? studentsList.find(s => s.student_id === e.student)?.note ?? "",
    }));

    updateBulk.mutate(records, {
      onSuccess: () => {
        toast.success(isFarsi ? `وضعیت همه به "${status}" تغییر یافت` : `All marked as ${status}`);
      },
      onError: () => {
        toast.error(isFarsi ? "خطا در تغییر وضعیت گروهی" : "Bulk update failed");
      },
    });
  };

  const statusBadgeColors = {
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    live: "bg-green-500/10 text-green-500 border-green-500/20 animate-pulse",
    completed: "bg-[var(--s3)] text-[var(--t3)] border-[var(--b)]",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <AppShell title={isFarsi ? "جزئیات جلسه درس" : "Session Details"}>
      <div className="flex flex-col gap-6">
        {/* Back Link Row */}
        <div className="flex justify-between items-center">
          <Link
            to="/academic/sessions"
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline no-underline"
          >
            {isFarsi ? (
              <>
                <span>لیست جلسات کلاس‌ها</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sessions List</span>
              </>
            )}
          </Link>
        </div>

        {/* Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1: Session Details and Stats Card (1/3 weight) */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            {/* Meta Card */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex justify-between items-start">
                <span
                  className={`px-3 py-1 rounded-full font-bold text-xs uppercase border ${
                    statusBadgeColors[session.status] || "bg-[var(--s3)]"
                  }`}
                >
                  {isFarsi && session.status === "scheduled" ? "برنامه‌ریزی شده" : 
                   isFarsi && session.status === "live" ? "در حال برگزاری" :
                   isFarsi && session.status === "completed" ? "پایان یافته" :
                   isFarsi && session.status === "cancelled" ? "لغو شده" : session.status}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--t1)]">{session.title}</h2>
                <Link
                  to={`/academic/classes/${session.academy_class}`}
                  className="text-xs text-[var(--brand)] hover:underline no-underline font-semibold mt-1 inline-block"
                >
                  {session.academy_class_name}
                </Link>
              </div>

              <hr className="border-[var(--b)]" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-xs text-[var(--t2)]">
                  <User className="w-4 h-4 text-[var(--t3)]" />
                  <span>
                    {isFarsi ? "مدرس:" : "Host:"}{" "}
                    {session.host ? (
                      <button
                        onClick={() => {
                          setInspectType("teacher");
                          setInspectId(session.host);
                        }}
                        className="bg-transparent border-none p-0 text-[var(--t1)] hover:text-[var(--brand)] hover:underline cursor-pointer font-bold align-baseline"
                      >
                        {session.host_name || "—"}
                      </button>
                    ) : (
                      <strong className="text-[var(--t1)]">{session.host_name || "—"}</strong>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--t2)]">
                  <Calendar className="w-4 h-4 text-[var(--t3)]" />
                  <span>
                    {session.scheduled_start
                      ? new Date(session.scheduled_start).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--t2)]">
                  <Clock className="w-4 h-4 text-[var(--t3)]" />
                  <span>
                    {session.scheduled_start
                      ? new Date(session.scheduled_start).toLocaleTimeString(isFarsi ? "fa-IR" : "en-US")
                      : "—"}
                    {" - "}
                    {session.scheduled_end
                      ? new Date(session.scheduled_end).toLocaleTimeString(isFarsi ? "fa-IR" : "en-US")
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Action triggers */}
              {canStartCompleteCancel && (
                <div className="flex flex-col gap-2 mt-2">
                  {session.status === "scheduled" && (
                    <Button
                      variant="success"
                      onClick={handleStart}
                      className="w-full justify-center h-10 font-bold"
                      loading={startSessionMutation.isPending}
                    >
                      {isFarsi ? "شروع جلسه کلاس" : "Start Session"}
                    </Button>
                  )}
                  {session.status === "live" && (
                    <>
                      <Link
                        to={`/room/${session.active_room_code}`}
                        className="inline-flex items-center justify-center gap-2 px-4 h-10 font-bold text-sm rounded-xl bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all cursor-pointer no-underline w-full"
                      >
                        <Video className="w-4 h-4" />
                        <span>{isFarsi ? "ورود به کلاس زنده" : "Join Live Room"}</span>
                      </Link>
                      <Button
                        variant="success"
                        onClick={handleComplete}
                        className="w-full justify-center h-10 font-bold"
                        loading={completeSessionMutation.isPending}
                      >
                        {isFarsi ? "اتمام جلسه" : "Complete Session"}
                      </Button>
                    </>
                  )}
                  {session.status === "scheduled" && (
                    <Button
                      variant="danger"
                      onClick={handleCancel}
                      className="w-full justify-center h-10 font-bold"
                      loading={cancelSessionMutation.isPending}
                    >
                      {isFarsi ? "لغو جلسه" : "Cancel Session"}
                    </Button>
                  )}
                </div>
              )}

              {session.status === "live" && !canStartCompleteCancel && (
                <Link
                  to={`/room/${session.active_room_code}`}
                  className="inline-flex items-center justify-center gap-2 px-4 h-10 font-bold text-sm rounded-xl bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all cursor-pointer no-underline w-full"
                >
                  <Video className="w-4 h-4" />
                  <span>{isFarsi ? "ورود به کلاس زنده" : "Join Room"}</span>
                </Link>
              )}

              {session.status === "completed" && sessionRecording && (
                <div className="flex flex-col gap-2 mt-2">
                  <Link
                    to={`/recordings/${sessionRecording.public_token}`}
                    className="inline-flex items-center justify-center gap-2 px-4 h-10 font-bold text-sm rounded-xl bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all cursor-pointer no-underline w-full"
                  >
                    <Video className="w-4 h-4" />
                    <span>{isFarsi ? "تماشای فیلم ضبط‌شده جلسه" : "Watch Session Recording"}</span>
                  </Link>
                </div>
              )}
            </div>

            {/* KPI Statistics Block */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider">
                {isFarsi ? "آمار حضور و غیاب" : "Attendance Metrics"}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--s3)] border border-[var(--b)] p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-[var(--t3)] font-semibold uppercase">{isFarsi ? "نرخ حضور" : "Rate"}</span>
                  <span className="text-lg font-extrabold text-[var(--brand)] mt-1 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" />
                    {attendanceRate.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-[var(--s3)] border border-[var(--b)] p-3 rounded-xl flex flex-col">
                  <span className="text-[10px] text-[var(--t3)] font-semibold uppercase">{isFarsi ? "ثبت شده" : "Recorded"}</span>
                  <span className="text-lg font-extrabold text-[var(--t1)] mt-1">
                    {recordedCount} / {totalEnrolled}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--t3)] font-medium">{isFarsi ? "حاضر" : "Present"}</span>
                  <span className="font-bold text-[var(--green)]">{presentCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--t3)] font-medium">{isFarsi ? "تاخیر" : "Late"}</span>
                  <span className="font-bold text-[var(--amber)]">{lateCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--t3)] font-medium">{isFarsi ? "غایب" : "Absent"}</span>
                  <span className="font-bold text-[var(--red)]">{absentCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--t3)] font-medium">{isFarsi ? "موجه" : "Excused"}</span>
                  <span className="font-bold text-purple-400">{excusedCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Participant Grid Table (2/3 weight) */}
          <div className="flex flex-col gap-4 lg:col-span-2 bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden">
            {/* Header controls */}
            <div className="p-4 border-b border-[var(--b)] flex flex-col md:flex-row gap-3 justify-between items-center">
              <span className="text-sm font-bold text-[var(--t1)] self-start md:self-center">
                {isFarsi ? "فهرست حضور و غیاب دانشجویان" : "Student Attendance Grid"}
              </span>

              {/* Bulk actions */}
              {canStartCompleteCancel && (
                <div className="flex gap-1.5 flex-wrap self-end md:self-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBulkMark("present")}
                    className="h-8 text-[var(--green)] hover:bg-[var(--green)]/10"
                    loading={updateBulk.isPending}
                  >
                    {isFarsi ? "حاضر کردن همه" : "Mark All Present"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBulkMark("absent")}
                    className="h-8 text-[var(--red)] hover:bg-[var(--red)]/10"
                    loading={updateBulk.isPending}
                  >
                    {isFarsi ? "غایب کردن همه" : "Mark All Absent"}
                  </Button>
                </div>
              )}
            </div>

            {/* Filter tools */}
            <div className="p-4 border-b border-[var(--b)] flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isFarsi ? "جستجوی دانشجو..." : "Search students..."}
                  className="w-full h-9"
                />
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-[var(--t3)] pointer-events-none" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-xl px-3 outline-none focus:border-[var(--brand)] transition-colors h-9"
              >
                <option value="all">{isFarsi ? "همه وضعیت‌ها" : "All Statuses"}</option>
                <option value="unrecorded">{isFarsi ? "ثبت نشده" : "Not Recorded"}</option>
                <option value="present">{isFarsi ? "حاضر" : "Present"}</option>
                <option value="late">{isFarsi ? "تأخیر" : "Late"}</option>
                <option value="absent">{isFarsi ? "غایب" : "Absent"}</option>
                <option value="excused">{isFarsi ? "موجه" : "Excused"}</option>
              </select>
            </div>

            {/* Table */}
            {filteredStudents.length === 0 ? (
              <div className="p-16 text-center text-sm text-[var(--t3)]">
                {isFarsi ? "هیچ دانشجویی یافت نشد." : "No students found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] uppercase text-left">
                      <th className="p-4">{isFarsi ? "دانشجو" : "Student"}</th>
                      <th className="p-4 w-48 text-center">{isFarsi ? "وضعیت حضور" : "Status Selector"}</th>
                      <th className="p-4">{isFarsi ? "یادداشت" : "Note"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const noteVal = studentNotes[s.student_id] ?? s.note;
                      const hasNoteChanged = noteVal !== s.note;

                      return (
                        <tr
                          key={s.student_id}
                          className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left align-middle"
                        >
                          <td className="p-4">
                            <div
                              className="flex items-center gap-2 cursor-pointer group"
                              onClick={() => {
                                setInspectType("student");
                                setInspectId(s.student_id);
                              }}
                            >
                              <div className="w-7 h-7 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center font-bold text-[10px] group-hover:border-[var(--brand)]">
                                {s.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-[var(--t1)] group-hover:text-[var(--brand)] transition-colors">
                                  {s.full_name}
                                </div>
                                <div className="text-[10px] text-[var(--t3)]">@{s.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {canStartCompleteCancel ? (
                              <div className="inline-flex rounded-lg border border-[var(--b)] p-0.5 bg-[var(--s3)]">
                                {(["present", "late", "absent", "excused"] as const).map((stat) => {
                                  const label = {
                                    present: isFarsi ? "حاضر" : "P",
                                    late: isFarsi ? "تأخیر" : "L",
                                    absent: isFarsi ? "غایب" : "A",
                                    excused: isFarsi ? "موجه" : "E",
                                  }[stat];

                                  const activeColors = {
                                    present: "bg-[var(--green)]/15 text-[var(--green)] font-extrabold",
                                    late: "bg-[var(--amber)]/15 text-[var(--amber)] font-extrabold",
                                    absent: "bg-[var(--red)]/15 text-[var(--red)] font-extrabold",
                                    excused: "bg-purple-500/15 text-purple-400 font-extrabold",
                                  }[stat];

                                  const isSelected = s.status === stat;

                                  return (
                                    <button
                                      key={stat}
                                      onClick={() => handleStatusChange(s.student_id, stat)}
                                      disabled={updateSingle.isPending}
                                      className={`px-3 py-1.5 rounded-md text-[10px] border-none font-semibold cursor-pointer transition-all hover:bg-[var(--b)]/30 ${
                                        isSelected ? activeColors : "bg-transparent text-[var(--t3)]"
                                      }`}
                                      title={stat.toUpperCase()}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                                  s.status === "present"
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : s.status === "late"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    : s.status === "absent"
                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                    : s.status === "excused"
                                    ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                    : "bg-[var(--s3)] text-[var(--t3)] border-[var(--b)]"
                                }`}
                              >
                                {s.status ? (isFarsi && s.status === "present" ? "حاضر" :
                                            isFarsi && s.status === "late" ? "تأخیر" :
                                            isFarsi && s.status === "absent" ? "غایب" :
                                            isFarsi && s.status === "excused" ? "موجه" : s.status) : (isFarsi ? "ثبت نشده" : "Unrecorded")}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            {canStartCompleteCancel ? (
                              <div className="flex items-center gap-1.5 max-w-[200px]">
                                <input
                                  type="text"
                                  value={noteVal}
                                  onChange={(e) =>
                                    setStudentNotes({
                                      ...studentNotes,
                                      [s.student_id]: e.target.value,
                                    })
                                  }
                                  placeholder={isFarsi ? "افزودن یادداشت..." : "Add note..."}
                                  className="flex-1 bg-[var(--s3)] text-[var(--t1)] text-[11px] border border-[var(--b)] rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--brand)] transition-colors"
                                />
                                {hasNoteChanged && (
                                  <button
                                    onClick={() => handleNoteSave(s.student_id)}
                                    disabled={updateSingle.isPending}
                                    className="p-1.5 rounded-lg bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all border-none cursor-pointer flex items-center justify-center"
                                    title={isFarsi ? "ذخیره" : "Save"}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--t2)] text-xs italic">{s.note || "—"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Smart Inspection Drawer */}
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
