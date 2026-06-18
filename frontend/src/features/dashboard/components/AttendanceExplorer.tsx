import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "../../sessions/api/sessions.api";
import { crmApi, type SimpleUser } from "../api/crm.api";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { useLocale } from "../../../i18n/useLocale";
import { useQueryParamState } from "../../../hooks/useQueryParamState";
import InspectionDrawer from "../../../components/ui/InspectionDrawer";
import { Search } from "lucide-react";

export default function AttendanceExplorer() {
  const { language } = useLocale();
  const isFarsi = language === "fa";

  const [inspectType, setInspectType] = useState<"student" | "teacher" | "mentor" | "course" | "class" | "session" | "invoice" | null>(null);
  const [inspectId, setInspectId] = useState<string | number | null>(null);

  // Filter & Pagination States
  const [selectedClass, setSelectedClass] = useQueryParamState("class_id", "");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [studentQuery, setStudentQuery] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentSearchResults, setStudentSearchResults] = useState<SimpleUser[]>([]);
  const [page, setPage] = useState(1);

  // Fetch Classes for dropdown
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  // Autocomplete student search
  useEffect(() => {
    if (studentQuery.length >= 2) {
      crmApi.searchUsers(studentQuery, "student").then(setStudentSearchResults);
    } else {
      setStudentSearchResults([]);
      if (studentQuery.length === 0) {
        setSelectedStudentId(null);
      }
    }
  }, [studentQuery]);

  // Main Attendance Query
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ["all-attendance", page, selectedClass, selectedStatus, selectedStudentId, studentQuery],
    queryFn: () =>
      sessionsApi.getAllAttendance({
        page,
        page_size: 15,
        status: selectedStatus || undefined,
        class_id: selectedClass ? parseInt(selectedClass) : undefined,
        student: selectedStudentId || undefined,
        q: selectedStudentId ? undefined : studentQuery || undefined,
      }),
  });

  // Query for computing summary stats (large page size, no paging, same filters)
  const { data: statsData } = useQuery({
    queryKey: ["attendance-stats-summary", selectedClass, selectedStatus, selectedStudentId, studentQuery],
    queryFn: () =>
      sessionsApi.getAllAttendance({
        page_size: 100,
        status: selectedStatus || undefined,
        class_id: selectedClass ? parseInt(selectedClass) : undefined,
        student: selectedStudentId || undefined,
        q: selectedStudentId ? undefined : studentQuery || undefined,
      }),
  });

  const records = attendanceData?.results || [];
  const totalCount = attendanceData?.count || 0;

  // Compute metrics from statsData
  const statsRecords = statsData?.results || [];
  const totalStatsCount = statsRecords.length;
  const presentCount = statsRecords.filter((r) => r.status === "present").length;
  const lateCount = statsRecords.filter((r) => r.status === "late").length;
  const absentCount = statsRecords.filter((r) => r.status === "absent").length;
  const excusedCount = statsRecords.filter((r) => r.status === "excused").length;

  const attendanceRate =
    totalStatsCount - excusedCount > 0
      ? ((presentCount + lateCount) / (totalStatsCount - excusedCount)) * 100
      : 100;

  const statusColors: Record<string, string> = {
    present: "bg-green-500/10 text-green-500 border-green-500/20",
    late: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    absent: "bg-red-500/10 text-red-500 border-red-500/20",
    excused: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const statusLabels: Record<string, string> = {
    present: isFarsi ? "حاضر" : "Present",
    late: isFarsi ? "تأخیر" : "Late",
    absent: isFarsi ? "غایب" : "Absent",
    excused: isFarsi ? "موجه" : "Excused",
  };

  return (
    <AppShell title={isFarsi ? "حضور و غیاب آکادمی" : "Attendance Explorer"}>
      <div className="flex flex-col gap-6">
        
        {/* KPI Metrics widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1 transition-all hover:-translate-y-0.5">
            <span className="text-[10px] text-[var(--t3)] uppercase font-semibold">{isFarsi ? "نرخ حضور" : "Attendance Rate"}</span>
            <span className="text-xl font-bold text-[var(--brand-text)]">{attendanceRate.toFixed(1)}%</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1 transition-all hover:-translate-y-0.5">
            <span className="text-[10px] text-[var(--t3)] uppercase font-semibold">{isFarsi ? "کل حاضرین" : "Present Logs"}</span>
            <span className="text-xl font-bold text-[var(--green)]">{presentCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1 transition-all hover:-translate-y-0.5">
            <span className="text-[10px] text-[var(--t3)] uppercase font-semibold">{isFarsi ? "کل تأخیرها" : "Late Logs"}</span>
            <span className="text-xl font-bold text-[var(--amber)]">{lateCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1 transition-all hover:-translate-y-0.5">
            <span className="text-[10px] text-[var(--t3)] uppercase font-semibold">{isFarsi ? "کل غایبین" : "Absent Logs"}</span>
            <span className="text-xl font-bold text-[var(--red)]">{absentCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1 transition-all hover:-translate-y-0.5">
            <span className="text-[10px] text-[var(--t3)] uppercase font-semibold">{isFarsi ? "غیبت موجه" : "Excused Logs"}</span>
            <span className="text-xl font-bold text-purple-400">{excusedCount}</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-end">
          {/* Student search input with autocomplete */}
          <div className="flex-1 w-full flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
              {isFarsi ? "جستجوی دانشجو" : "Student"}
            </label>
            <div className="relative">
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder={isFarsi ? "نام دانشجو..." : "Student name..."}
                className="w-full"
              />
              <Search className="w-4 h-4 absolute right-3 top-3.5 text-[var(--t3)] pointer-events-none" />
            </div>

            {studentSearchResults.length > 0 && (
              <div className="absolute top-[100%] left-0 right-0 z-50 bg-[var(--s3)] border border-[var(--b)] rounded-lg p-1 max-h-[150px] overflow-y-auto mt-1 shadow-lg flex flex-col gap-1">
                {studentSearchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(u.id);
                      setStudentQuery(u.full_name || u.username);
                      setStudentSearchResults([]);
                    }}
                    className="w-full text-start p-2 hover:bg-[var(--brand-soft)] rounded text-xs text-[var(--t1)] border-none bg-transparent cursor-pointer"
                  >
                    {u.full_name} ({u.username})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Class dropdown */}
          <div className="w-full md:w-56 flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
              {isFarsi ? "کلاس درس" : "Class"}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
              className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors h-11"
            >
              <option value="">{isFarsi ? "همه کلاس‌ها" : "All Classes"}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Status dropdown */}
          <div className="w-full md:w-48 flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
              {isFarsi ? "وضعیت حضور" : "Status"}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors h-11"
            >
              <option value="">{isFarsi ? "همه وضعیت‌ها" : "All statuses"}</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(selectedClass || selectedStatus || studentQuery || selectedStudentId) && (
            <Button
              variant="secondary"
              className="h-11 px-4 whitespace-nowrap w-full md:w-auto"
              onClick={() => {
                setSelectedClass("");
                setSelectedStatus("");
                setStudentQuery("");
                setSelectedStudentId(null);
                setPage(1);
              }}
            >
              {isFarsi ? "پاک کردن فیلترها" : "Reset"}
            </Button>
          )}
        </div>

        {/* Attendance Explorer Table List */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-16 flex justify-center"><Spinner /></div>
          ) : records.length === 0 ? (
            <div className="p-16 text-center text-[var(--t3)] text-sm">
              {isFarsi ? "هیچ گزارش حضور و غیابی یافت نشد." : "No attendance logs found matching current criteria."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                    <th className="p-4">{isFarsi ? "دانشجو" : "Student"}</th>
                    <th className="p-4">{isFarsi ? "کلاس" : "Class"}</th>
                    <th className="p-4">{isFarsi ? "جلسه مربوطه" : "Session"}</th>
                    <th className="p-4">{isFarsi ? "وضعیت حضور" : "Status"}</th>
                    <th className="p-4">{isFarsi ? "ساعت ورود" : "Joined"}</th>
                    <th className="p-4">{isFarsi ? "توضیحات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4">
                        <div 
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => {
                            setInspectType("student");
                            setInspectId(r.student);
                          }}
                        >
                          <div className="w-7 h-7 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[10px] font-bold group-hover:border-[var(--brand)]">
                            {(r.student_full_name || r.student_username || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--t1)] group-hover:text-[var(--brand)] transition-colors">{r.student_full_name || r.student_username}</div>
                            <div className="text-[10px] text-[var(--t3)]">@{r.student_username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-medium">
                        {r.academy_class ? (
                          <Link to={`/academic/classes/${r.academy_class}`} className="text-[var(--brand-text)] hover:underline no-underline font-semibold">
                            {r.academy_class_name || `#${r.academy_class}`}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="p-4 font-medium">
                        {r.session ? (
                          <Link to={`/academic/sessions/${r.session}`} className="text-[var(--brand-text)] hover:underline no-underline font-semibold">
                            {r.session_title || `#${r.session}`}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusColors[r.status] || "bg-[var(--s3)]"}`}>
                          {statusLabels[r.status] || r.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[var(--t3)] font-mono">
                        {r.joined_at ? new Date(r.joined_at).toLocaleTimeString() : "—"}
                      </td>
                      <td className="p-4 text-xs text-[var(--t2)] max-w-xs truncate">
                        {r.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table pagination footer */}
              {totalCount > 15 && (
                <div className="flex justify-between items-center p-4 border-t border-[var(--b)] bg-[var(--s1)]/30">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {isFarsi ? "قبلی" : "Previous"}
                  </Button>
                  <span className="text-xs text-[var(--t3)]">
                    {isFarsi
                      ? `صفحه ${page} از ${Math.ceil(totalCount / 15)}`
                      : `Page ${page} of ${Math.ceil(totalCount / 15)}`}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page >= Math.ceil(totalCount / 15)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isFarsi ? "بعدی" : "Next"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
