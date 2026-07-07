import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AppShell from "../../../components/layout/AppShell";
import { useAuthStore } from "../../auth/store/authStore";
import { useRoom } from "../../room/hooks/useRoom";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { useSessions } from "../../sessions/hooks/useSessions";
import { sessionsApi } from "../../sessions/api/sessions.api";
import { crmApi } from "../api/crm.api";
import Spinner from "../../../components/ui/Spinner";
import { Play, Calendar, Video, Clock, BookOpen, CreditCard, ChevronRight, Award } from "lucide-react";
import { useNotificationsStore } from "../../auth/store/notificationsStore";
import { assessmentsApi } from "../../assessments/api/assessments.api";
import recordingsApi from "../../recordings/api/recordings.api";
import { authApi } from "../../auth/api/auth.api";
import { useOrgContextStore } from "../../auth/store/orgContextStore";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { toast } from "react-hot-toast";


export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { hasPermission, activeRole: rawActiveRole, activeOrg } = useOrgPermission();
  const [activeNav, setActiveNav] = useState("dashboard");
  const { createRoom, isLoading: roomLoading } = useRoom();
  const navigate = useNavigate();

  // Guest flow states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("action") === "create-org") {
      setShowCreateModal(true);
      navigate(location.pathname, { replace: true });
    } else if (params.get("action") === "join-org") {
      setShowJoinModal(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate]);
  const [orgName, setOrgName] = useState("");
  const [orgCodeOrSlug, setOrgCodeOrSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: invitations = [], refetch: refetchInvitations } = useQuery({
    queryKey: ["invitations"],
    queryFn: authApi.getInvitations,
    enabled: !activeOrg,
  });

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const newOrg = await authApi.createOrganization(orgName);
      toast.success(isFarsi ? "سازمان با موفقیت ایجاد شد." : "Organization created successfully!");
      setOrgName("");
      setShowCreateModal(false);
      const { fetchOrgContext } = useOrgContextStore.getState();
      await fetchOrgContext(newOrg.slug);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.response?.data?.detail || "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgCodeOrSlug.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const res = await authApi.joinOrganization(orgCodeOrSlug);
      toast.success(res.message || (isFarsi ? "درخواست عضویت ارسال شد." : "Join request submitted."));
      setOrgCodeOrSlug("");
      setShowJoinModal(false);
      
      if (res.auto_joined) {
        await useAuthStore.getState().fetchMe();
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(orgCodeOrSlug);
      } else {
        refetchInvitations();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.response?.data?.detail || "Failed to join organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondInvite = async (orgSlug: string, action: "accept" | "decline") => {
    try {
      await authApi.respondInvitation(orgSlug, action);
      refetchInvitations();
      if (action === "accept") {
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(orgSlug);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.detail || "Failed to respond to invitation");
    }
  };

  const isFarsi = language === "fa";
  const activeRole = (rawActiveRole || "").toLowerCase();

  const canManageCRM = hasPermission("can_manage_members") || hasPermission("can_teach_class");
  const canManageFinance = hasPermission("can_manage_financials") || hasPermission("can_view_financials");

  // Queries
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
    enabled: canManageCRM && !!activeOrg,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
    enabled: canManageCRM && !!activeOrg,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
    enabled: !!activeOrg,
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["financeSummary"],
    queryFn: crmApi.getFinanceSummary,
    enabled: hasPermission("can_view_financials") && !!activeOrg,
  });

  const { data: liveSessions = [], isLoading: loadingSessions } = useSessions(undefined, "live", { enabled: !!activeOrg });

  const { data: allSessions = [], isLoading: loadingAllSessions } = useQuery({
    queryKey: ["sessions-all"],
    queryFn: () => sessionsApi.getSessions(),
    enabled: !!activeOrg,
  });

  const { data: allSubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ["all-submissions-teacher"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
    enabled: (activeRole === "teacher" || activeRole === "admin") && !!activeOrg,
  });

  const { data: allAssessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ["all-assessments-student"],
    queryFn: () => assessmentsApi.getAssessments(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: studentSubmissions = [], isLoading: loadingStudentSubmissions } = useQuery({
    queryKey: ["student-submissions"],
    queryFn: () => assessmentsApi.getSubmissions(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: allAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["all-assignments-student"],
    queryFn: () => assessmentsApi.getAssignments(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: myAssignmentSubmissions = [], isLoading: loadingMyAssignmentSubmissions } = useQuery({
    queryKey: ["my-assignment-submissions"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: recordingsData, isLoading: loadingRecordings } = useQuery({
    queryKey: ["recordings-student"],
    queryFn: () => recordingsApi.list({ published: true }),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: studentAttendance, isLoading: loadingStudentAttendance } = useQuery({
    queryKey: ["student-attendance-kpi"],
    queryFn: () => sessionsApi.getAllAttendance({ page_size: 100 }),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: studentInvoicesBalance, isLoading: loadingStudentInvoices } = useQuery({
    queryKey: ["student-invoices-balance"],
    queryFn: () => crmApi.getInvoiceBalance(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("greeting.morning");
    if (h < 17) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  const localeTag = language === "fa" ? "fa-IR" : "en-US";
  const subtitle = new Date().toLocaleDateString(localeTag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Financial Summary Helpers
  const totalRevenue = summaryData?.revenue || 0;
  const totalPendingRevenue = summaryData?.outstanding || 0;
  const totalExpense = summaryData?.expenses || 0;

  const totalAttendanceCount = studentAttendance?.results?.length || 0;
  const presentCount = studentAttendance?.results?.filter((r: any) => r.status === "present").length || 0;
  const attendanceRate = totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : 100;

  const isDataLoading = loadingCourses || loadingClasses || loadingEnrollments || loadingSummary || loadingSessions || loadingAllSessions || ((activeRole === "teacher" || activeRole === "admin") && loadingSubmissions) || (activeRole === "student" && (loadingAssessments || loadingStudentSubmissions || loadingAssignments || loadingMyAssignmentSubmissions || loadingRecordings || loadingStudentAttendance || loadingStudentInvoices));

  // Aggregated data for past 6 months
  const chartData = summaryData?.monthly_trends || [
    { label: "Jan", revenue: 0, expense: 0 },
    { label: "Feb", revenue: 0, expense: 0 },
    { label: "Mar", revenue: 0, expense: 0 },
    { label: "Apr", revenue: 0, expense: 0 },
    { label: "May", revenue: 0, expense: 0 },
    { label: "Jun", revenue: 0, expense: 0 }
  ];

  const maxVal = Math.max(
    ...chartData.map(d => Math.max(d.revenue, d.expense)),
    100
  );
  const roundMaxVal = Math.ceil(maxVal / 100) * 100;

  const getBezierPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const getX = (index: number) => 50 + (index * 530) / 5;
  const getY = (value: number) => 210 - (value * 190) / roundMaxVal;

  const pointsRevenue = chartData.map((d, idx) => ({ x: getX(idx), y: getY(d.revenue) }));
  const pointsExpense = chartData.map((d, idx) => ({ x: getX(idx), y: getY(d.expense) }));

  const revenuePath = getBezierPath(pointsRevenue);
  const expensePath = getBezierPath(pointsExpense);

  const revenueArea = pointsRevenue.length > 0 ? `${revenuePath} L ${getX(pointsRevenue.length - 1)} 210 L ${getX(0)} 210 Z` : "";
  const expenseArea = pointsExpense.length > 0 ? `${expensePath} L ${getX(pointsExpense.length - 1)} 210 L ${getX(0)} 210 Z` : "";

  // Next Up Session Logic
  const scheduledSessions = allSessions
    .filter((s) => s.status === "scheduled" && s.scheduled_start && new Date(s.scheduled_start) > new Date())
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());

  const nextSession = scheduledSessions[0] || null;

  const [countdownText, setCountdownText] = useState("");

  const updateCountdown = () => {
    if (!nextSession || !nextSession.scheduled_start) {
      setCountdownText("");
      return;
    }
    const diff = new Date(nextSession.scheduled_start).getTime() - new Date().getTime();
    if (diff <= 0) {
      setCountdownText(isFarsi ? "هم‌اکنون شروع شده" : "Starts now");
    } else if (diff < 300000) {
      setCountdownText(isFarsi ? "به‌زودی شروع می‌شود" : "Starting soon");
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      setCountdownText(isFarsi ? `شروع در ${mins} دقیقه` : `Starts in ${mins} minutes`);
    } else if (diff < 86400000) {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setCountdownText(
        isFarsi
          ? `شروع در ${hrs} ساعت و ${mins} دقیقه`
          : `Starts in ${hrs} hours, ${mins} minutes`
      );
    } else {
      const dateVal = new Date(nextSession.scheduled_start);
      setCountdownText(
        dateVal.toLocaleDateString(localeTag, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) +
        " " +
        dateVal.toLocaleTimeString(localeTag, {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  };

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextSession, language]);

  // Notifications for Activity Feed
  const notifications = useNotificationsStore((s) => s.items);
  const hydrateNotifications = useNotificationsStore((s) => s.hydrate);

  useEffect(() => {
    hydrateNotifications();
  }, []);

  const pendingSubmissions = allSubmissions.filter((sub) => sub.status === "submitted");

  const teacherCompletedSessions = allSessions.filter(
    (s) => s.host === user?.id && s.status === "completed"
  );
  const taughtHours = teacherCompletedSessions.length * 1.5;

  const myTaughtClasses = classes.filter((c) => c.teacher === user?.id);

  const recentActivity = notifications.slice(0, 5);

  const enrolledClassIds = enrollments
    .filter((e) => e.student === user?.id && e.is_active)
    .map((e) => e.academy_class);

  const studentSessions = allSessions.filter((s) => enrolledClassIds.includes(s.academy_class));

  const upcomingExams = allAssessments.filter(
    (a) => a.is_published && a.session && studentSessions.some((s) => s.id === a.session)
  );

  const pendingAssignments = allAssignments.filter(
    (a) => !myAssignmentSubmissions.some((sub) => sub.assignment === a.id)
  );

  const gradedAssignmentSubmissions = myAssignmentSubmissions
    .filter((sub) => sub.status === "graded" && sub.grade !== null)
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());

  const studentRecordings = recordingsData?.results || [];

  const formatRelativeTime = (ms: number) => {
    const diff = Math.max(0, Date.now() - ms);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return isFarsi ? "هم‌اکنون" : "just now";
    if (min < 60) return isFarsi ? `${min} دقیقه پیش` : `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return isFarsi ? `${h} ساعت پیش` : `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return isFarsi ? `${d} روز پیش` : `${d}d ago`;
    return new Date(ms).toLocaleDateString(isFarsi ? "fa-IR" : "en-US");
  };

  const getNotificationText = (item: any) => {
    const data = item.data || {};
    const kind = item.kind;
    if (kind === "ROOM_INVITE") {
      return {
        title: isFarsi
          ? `دعوت به کلاس زنده از طرف ${data.from || ""}`
          : `Live Room Invite from ${data.from || ""}`,
        desc: (data.room_name as string) || (data.room_code as string) || "",
        icon: "📹",
        link: data.room_code ? `/room/${data.room_code}` : "/dashboard",
      };
    }
    if (kind === "RECORDING_PUBLISHED") {
      return {
        title: isFarsi
          ? `ضبط کلاس منتشر شد توسط ${data.from || ""}`
          : `Class Recording Published by ${data.from || ""}`,
        desc: (data.room_name as string) || (data.room_code as string) || "",
        icon: "🎥",
        link: data.recording_token ? `/recordings/${data.recording_token}` : "/recordings",
      };
    }
    if (kind === "RECORDING_PERMISSION_GRANTED") {
      return {
        title: isFarsi ? "دسترسی به ضبط کلاس تایید شد" : "Recording Access Granted",
        desc: (data.room_name as string) || (data.room_code as string) || "",
        icon: "🔓",
        link: data.room_code ? `/room/${data.room_code}` : "/dashboard",
      };
    }
    if (kind === "RECORDING_PERMISSION_REVOKED") {
      return {
        title: isFarsi ? "دسترسی به ضبط کلاس لغو شد" : "Recording Access Revoked",
        desc: (data.room_name as string) || (data.room_code as string) || "",
        icon: "🔒",
        link: data.room_code ? `/room/${data.room_code}` : "/dashboard",
      };
    }
    if (kind === "ASSESSMENT_GRADED") {
      return {
        title: isFarsi ? "آزمون نمره‌دهی شد" : "Exam Graded",
        desc: isFarsi
          ? `آزمون: ${data.assessment_title || ""} • نمره: ${data.score || ""}/${data.total_points || ""}`
          : `Exam: ${data.assessment_title || ""} • Grade: ${data.score || ""}/${data.total_points || ""}`,
        icon: "🏆",
        link: "/academic/assessments",
      };
    }
    if (kind === "INVOICE_CREATED") {
      return {
        title: isFarsi ? "فاکتور مالی جدید صادر شد" : "New Invoice Created",
        desc: isFarsi
          ? `شماره فاکتور: ${data.invoice_number || ""} • مبلغ: ${data.amount || ""}`
          : `Invoice: ${data.invoice_number || ""} • Amount: ${data.amount || ""}`,
        icon: "🧾",
        link: "/finance/ledger",
      };
    }
    if (kind === "INVOICE_UPDATED") {
      return {
        title: isFarsi ? "فاکتور مالی بروزرسانی شد" : "Invoice Updated",
        desc: isFarsi
          ? `شماره فاکتور: ${data.invoice_number || ""} • وضعیت: ${data.status || ""}`
          : `Invoice: ${data.invoice_number || ""} • Status: ${data.status || ""}`,
        icon: "💵",
        link: "/finance/ledger",
      };
    }
    if (kind === "SESSION_STARTED") {
      return {
        title: isFarsi ? "جلسه جدید شروع شد" : "New Session Started",
        desc: isFarsi
          ? `کلاس: ${data.class_name || ""} • مدرس: ${data.host_name || ""}`
          : `Class: ${data.class_name || ""} • Host: ${data.host_name || ""}`,
        icon: "🔴",
        link: data.room_code ? `/room/${data.room_code}` : "/academic/sessions",
      };
    }
    return {
      title: (data.title as string) || (isFarsi ? "اعلان جدید" : "New Notification"),
      desc: (data.message as string) || "",
      icon: "🔔",
      link: "/dashboard",
    };
  };

  const liveSession = liveSessions[0] || null;

  // Today's sessions list
  const todaySessions = allSessions.filter((s) => {
    if (!s.scheduled_start) return false;
    const sDate = new Date(s.scheduled_start);
    const today = new Date();
    return (
      sDate.getDate() === today.getDate() &&
      sDate.getMonth() === today.getMonth() &&
      sDate.getFullYear() === today.getFullYear()
    );
  });

  // Upcoming assignments deadlines
  const upcomingDeadlines = allAssignments.filter((a) => {
    const hasSubmitted = myAssignmentSubmissions.some((sub) => sub.assignment === a.id);
    const isFuture = a.due_date ? new Date(a.due_date) > new Date() : true;
    return !hasSubmitted && isFuture;
  });

  // GPA calculation
  const avgGrade = gradedAssignmentSubmissions.length > 0
    ? gradedAssignmentSubmissions.reduce((acc, sub) => acc + parseFloat(sub.grade || "0"), 0) / gradedAssignmentSubmissions.length
    : 98;
  const calculatedGPA = ((avgGrade / 100) * 4.0).toFixed(2);
  const studyStreak = 12;
  const semesterProgress = 68;

  const getDueHours = (dueDateStr?: string) => {
    if (!dueDateStr) return 24;
    const diff = new Date(dueDateStr).getTime() - Date.now();
    const hrs = Math.ceil(diff / 3600000);
    return hrs > 0 ? hrs : 0;
  };

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(localeTag, { month: "short", day: "numeric" });
  };

  // Upcoming Agenda logic
  const upcomingSessions = allSessions
    .filter((s) => s.status === "scheduled" && s.scheduled_start && new Date(s.scheduled_start) > new Date())
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
    .slice(0, 5);

  const studentPoints = gradedAssignmentSubmissions.map((sub, idx) => {
    const x = 50 + (idx * 500) / Math.max(1, gradedAssignmentSubmissions.length - 1);
    const val = parseFloat(sub.grade || "0");
    const y = 160 - (val * 130) / 100;
    return { x, y };
  });

  const studentPath = getBezierPath(studentPoints);
  const studentArea = studentPoints.length > 0
    ? `${studentPath} L ${studentPoints[studentPoints.length - 1].x} 160 L 50 160 Z`
    : "";

  const isStudent = activeRole === "student";

  if (isStudent && activeOrg) {
    return (
      <AppShell
        title={t("title")}
        subtitle={subtitle}
        activeNav={activeNav}
        onNavigate={setActiveNav}
      >
        <div className="flex flex-col gap-6 fade-in text-[var(--t1)]">
          {/* Welcome back header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
                {isFarsi ? `خوش آمدی، ${user?.full_name?.split(" ")[0] || user?.username}` : `Welcome back, ${user?.full_name?.split(" ")[0] || user?.username}.`}
              </h1>
              <p className="text-xs md:text-sm text-[var(--t3)] mt-1 font-medium">
                {isFarsi
                  ? `امروز شما ${todaySessions.length} کلاس و ${pendingAssignments.length} مهلت تحویل دارید.`
                  : `You have ${todaySessions.length} classes today and ${pendingAssignments.length} upcoming deadlines.`}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {/* GPA capsule */}
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-black">✓</span>
                <span>{isFarsi ? `معدل کل ${calculatedGPA}` : `Current GPA ${calculatedGPA}`}</span>
              </div>
              {/* Streak capsule */}
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm">
                <span className="text-sm">🔥</span>
                <span>{isFarsi ? `زنجیره مطالعه ${studyStreak} روز` : `Study Streak ${studyStreak} Days`}</span>
              </div>
            </div>
          </div>

          {/* Row 1: Grid for Schedule and Grade Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* My Schedule Widget */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm lg:col-span-2 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--t3)]">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{isFarsi ? "برنامه من" : "My Schedule"}</span>
                </h2>
                <Link to="/academic/sessions" className="text-xs font-semibold text-[var(--t3)] hover:text-[var(--brand)] no-underline">
                  {isFarsi ? "مشاهده تقویم" : "View Calendar"}
                </Link>
              </div>

              <div className="flex flex-col gap-3.5">
                {todaySessions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--t3)] bg-[var(--s3)] rounded-2xl border border-[var(--b)] border-dashed">
                    {isFarsi ? "هیچ جلسه‌ای برای امروز برنامه‌ریزی نشده است. روز آزاد خود را لذت ببرید!" : "No classes scheduled for today. Enjoy your day off!"}
                  </div>
                ) : (
                  todaySessions.map((s) => {
                    const isLive = s.status === "live";
                    const sTime = s.scheduled_start ? new Date(s.scheduled_start) : null;
                    const eTime = s.scheduled_end ? new Date(s.scheduled_end) : null;
                    const timeRange = sTime && eTime
                      ? `${sTime.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })} - ${eTime.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}`
                      : "";

                    return (
                      <div key={s.id} className="bg-[var(--s3)] border border-[var(--b)] rounded-[18px] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:bg-[var(--s3)]/80">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg shadow-inner",
                            isLive ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-[var(--s2)] text-[var(--t3)]"
                          )}>
                            {isLive ? <Video className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <h4 className="text-xs font-bold text-[var(--t1)] truncate">{s.title}</h4>
                            <p className="text-[10px] text-[var(--t3)] mt-0.5 truncate font-medium">
                              {s.host_name} • {timeRange}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end flex-shrink-0">
                          {isLive ? (
                            <>
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 animate-pulse uppercase tracking-wider">
                                {isFarsi ? "هم‌اکنون زنده" : "Live Now"}
                              </span>
                              <Link
                                to={`/room/${s.active_room_code}`}
                                className="px-4 py-2 rounded-xl bg-[#6366f1] text-white hover:brightness-110 font-bold text-xs shadow-md transition-all active:scale-[0.98] no-underline"
                              >
                                {isFarsi ? "ورود به کلاس" : "Join Class"}
                              </Link>
                            </>
                          ) : (
                            <Link
                              to={`/academic/sessions/${s.id}`}
                              className="px-4 py-2 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] text-[var(--t2)] hover:text-[var(--t1)] font-bold text-xs transition-all active:scale-[0.98] no-underline"
                            >
                              {isFarsi ? "جزئیات" : "Details"}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Grade Trend Widget */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm flex flex-col justify-between min-h-[300px]">
              <div>
                <h2 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--t3)]">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  <span>{isFarsi ? "روند نمرات" : "Grade Trend"}</span>
                </h2>
                
                {gradedAssignmentSubmissions.length === 0 ? (
                  <div className="h-[140px] flex flex-col items-center justify-center gap-2 text-[var(--t3)] text-xs">
                    <span className="text-xl">📈</span>
                    <span>{isFarsi ? "هنوز نمره‌ای ثبت نشده است." : "No grades recorded yet."}</span>
                  </div>
                ) : (
                  <div className="w-full h-[140px] relative overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 240 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="gradeGradMini" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Gridlines */}
                      {[0, 50, 100].map((ratio) => {
                        const y = 100 - (ratio * 80) / 100;
                        return (
                          <line key={ratio} x1="10" y1={y} x2="230" y2={y} stroke="var(--b)" strokeWidth="0.8" strokeDasharray="3 3" />
                        );
                      })}
                      {/* Bezier Path */}
                      {gradedAssignmentSubmissions.length > 1 && (
                        <>
                          <path
                            d={getBezierPath(gradedAssignmentSubmissions.map((sub, idx) => {
                              const x = 15 + (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                              const y = 100 - (parseFloat(sub.grade || "0") * 80) / 100;
                              return { x, y };
                            }))}
                            fill="none"
                            stroke="var(--brand)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d={`${getBezierPath(gradedAssignmentSubmissions.map((sub, idx) => {
                              const x = 15 + (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                              const y = 100 - (parseFloat(sub.grade || "0") * 80) / 100;
                              return { x, y };
                            }))} L ${15 + ((gradedAssignmentSubmissions.length - 1) * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1)} 100 L 15 100 Z`}
                            fill="url(#gradeGradMini)"
                          />
                        </>
                      )}
                      {/* Months labels */}
                      {gradedAssignmentSubmissions.map((sub, idx) => {
                        const x = 15 + (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                        const label = sub.assignment_title?.slice(0, 3) || `HW${idx + 1}`;
                        return (
                          <text key={idx} x={x} y="118" fill="var(--t3)" fontSize="7" textAnchor="middle" fontWeight="bold">
                            {label}
                          </text>
                        );
                      })}
                      {/* Data Points */}
                      {gradedAssignmentSubmissions.map((sub, idx) => {
                        const x = 15 + (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                        const val = parseFloat(sub.grade || "0");
                        const y = 100 - (val * 80) / 100;
                        return (
                          <circle key={idx} cx={x} cy={y} r="3" fill="var(--s2)" stroke="var(--brand)" strokeWidth="1.8" />
                        );
                      })}
                    </svg>
                  </div>
                )}
              </div>

              {/* Semester Progress */}
              <div className="border-t border-[var(--b)] pt-3.5 mt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-[var(--t1)]">
                  <span>{isFarsi ? "پیشرفت ترم تحصیلی" : "Semester Progress"}</span>
                  <span className="font-mono">{semesterProgress}%</span>
                </div>
                <div className="w-full bg-[var(--s3)] rounded-full h-2 overflow-hidden border border-[var(--b)]">
                  <div className="bg-[#6366f1] h-full rounded-full transition-all duration-500" style={{ width: `${semesterProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Homework Progress Section */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-extrabold text-[var(--t1)] tracking-tight">
                {isFarsi ? "پیشرفت تکالیف" : "Homework Progress"}
              </h2>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-xl bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 text-[var(--t3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                </button>
                <Link to="/academic/homework" className="px-3.5 py-1.5 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/30 text-[11px] font-bold text-[var(--t1)] rounded-xl no-underline transition-colors flex items-center justify-center">
                  {isFarsi ? "مشاهده همه" : "View All"}
                </Link>
              </div>
            </div>

            {/* Assignments Grid (3 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Overdue / Due Soon */}
              {pendingAssignments.length > 0 ? (() => {
                const a = pendingAssignments[0];
                const dueHours = getDueHours(a.due_date);
                return (
                  <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-[24px] p-5 flex flex-col justify-between gap-5 transition-all hover:translate-y-[-2px] shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
                          {isFarsi ? `تحویل تا ${dueHours} ساعت دیگر` : `DUE IN ${dueHours}H`}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{a.title}</h3>
                      <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">{a.academy_class_name} • {a.created_by_name || "Instructor"}</p>
                    </div>
                    <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1">
                      <div className="flex -space-x-1.5">
                        <div className="w-5.5 h-5.5 rounded-full bg-indigo-600 border-2 border-[var(--s2)] flex items-center justify-center text-[9px] text-white font-bold select-none">JD</div>
                        <div className="w-5.5 h-5.5 rounded-full bg-teal-600 border-2 border-[var(--s2)] flex items-center justify-center text-[9px] text-white font-bold select-none">KL</div>
                      </div>
                      <Link to={`/academic/homework`} className="text-[11px] font-extrabold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline flex items-center gap-1">
                        {isFarsi ? "ارسال پاسخ" : "Submit Work"} →
                      </Link>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 flex flex-col justify-between gap-5 shadow-sm opacity-60">
                  <div className="flex flex-col gap-3">
                    <div className="flex">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
                        {isFarsi ? "تحویل موعد" : "No Due Tasks"}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{isFarsi ? "هیچ تکلیفی در مهلت فوری نیست" : "No homework due soon"}</h3>
                  </div>
                  <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                    {isFarsi ? "کلاس‌ها بدون موعد تکلیف" : "Everything is up to date"}
                  </div>
                </div>
              )}

              {/* Card 2: Draft / In Progress */}
              {pendingAssignments.length > 1 ? (() => {
                const a = pendingAssignments[1];
                const sTime = a.due_date ? new Date(a.due_date) : null;
                const totalDays = sTime ? Math.max(1, Math.ceil((sTime.getTime() - Date.now()) / 86400000)) : 2;
                return (
                  <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-[24px] p-5 flex flex-col justify-between gap-5 transition-all hover:translate-y-[-2px] shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                          {isFarsi ? `${totalDays} روز باقی‌مانده` : `${totalDays} DAYS LEFT`}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{a.title}</h3>
                      <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">{a.academy_class_name} • {a.created_by_name || "Instructor"}</p>
                    </div>
                    <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1 text-xs">
                      <span className="text-[10px] text-[var(--t3)] flex items-center gap-1 select-none font-semibold">
                        <span className="text-[var(--green)] font-bold">✓</span> {isFarsi ? "پیش‌نویس ذخیره شد" : "Draft Saved"}
                      </span>
                      <Link to={`/academic/homework`} className="text-[11px] font-extrabold text-[var(--brand)] hover:opacity-80 transition-opacity no-underline flex items-center gap-1">
                        {isFarsi ? "ادامه تکلیف" : "Continue"} 📝
                      </Link>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 flex flex-col justify-between gap-5 shadow-sm opacity-60">
                  <div className="flex flex-col gap-3">
                    <div className="flex">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                        {isFarsi ? "بدون پیش‌نویس" : "No Drafts"}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{isFarsi ? "هیچ پیش‌نویسی ذخیره نشده" : "No homework drafts"}</h3>
                  </div>
                  <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                    {isFarsi ? "کاری در جریان نیست" : "All clean"}
                  </div>
                </div>
              )}

              {/* Card 3: Graded / Completed */}
              {gradedAssignmentSubmissions.length > 0 ? (() => {
                const sub = gradedAssignmentSubmissions[0];
                const dateText = sub.graded_at ? formatDueDate(sub.graded_at) : (isFarsi ? "اخیر" : "Recent");
                return (
                  <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-[24px] p-5 flex flex-col justify-between gap-5 transition-all hover:translate-y-[-2px] shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                          {isFarsi ? `تصحیح شده: نمره ${sub.grade}` : `GRADED: ${sub.grade}`}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{sub.assignment_title}</h3>
                      <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">{sub.academy_class_name || (isFarsi ? "کلاس من" : "My Class")}</p>
                    </div>
                    <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1 text-xs">
                      <span className="text-[10px] text-[var(--t3)] font-medium select-none">
                        {isFarsi ? `تکمیل در ${dateText}` : `Completed ${dateText}`}
                      </span>
                      <button
                        onClick={() => {
                          if (sub.feedback) {
                            toast(sub.feedback, { icon: "💬", duration: 6000 });
                          } else {
                            toast.success(isFarsi ? "بازخورد متنی ثبت نشده است." : "No written feedback submitted yet.");
                          }
                        }}
                        className="text-[11px] font-extrabold text-[var(--t2)] hover:text-[var(--t1)] bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <span>{isFarsi ? "بازخورد" : "Feedback"}</span> 💬
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 flex flex-col justify-between gap-5 shadow-sm opacity-60">
                  <div className="flex flex-col gap-3">
                    <div className="flex">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                        {isFarsi ? "بدون نمره" : "No Grades"}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">{isFarsi ? "تکلیف نمره‌دهی شده وجود ندارد" : "No graded assignments yet"}</h3>
                  </div>
                  <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                    {isFarsi ? "در انتظار تصحیح اساتید" : "Awaiting evaluations"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Recent Recordings Carousel */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-[var(--t1)] tracking-tight flex items-center gap-2">
                <span>▶️</span> {isFarsi ? "ویدیوهای ضبط‌شده اخیر" : "Recent Recordings"}
              </h2>
              <div className="flex items-center gap-1.5">
                <button className="p-2.5 rounded-full bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 text-[var(--t3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center w-8 h-8 transition-colors select-none font-bold">
                  &lt;
                </button>
                <button className="p-2.5 rounded-full bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 text-[var(--t3)] hover:text-[var(--t1)] cursor-pointer flex items-center justify-center w-8 h-8 transition-colors select-none font-bold">
                  &gt;
                </button>
              </div>
            </div>

            {studentRecordings.length === 0 ? (
              <div className="p-10 text-center text-xs text-[var(--t3)] bg-[var(--s2)] rounded-3xl border border-[var(--b)] border-dashed">
                {isFarsi ? "هیچ ویدیو ضبط شده‌ای برای شما در دسترس نیست." : "No recordings available currently."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {studentRecordings.slice(0, 3).map((rec) => {
                  const durationMin = Math.round(rec.duration_seconds / 60);
                  const qualityTag = rec.quality || "720p";
                  return (
                    <div key={rec.public_token} className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-[24px] p-4 flex flex-col gap-3 transition-all hover:translate-y-[-2px] shadow-sm">
                      {/* Image Thumbnail Box */}
                      <div className="relative aspect-video rounded-[18px] overflow-hidden bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center shadow-inner group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/15 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--t3)] opacity-70 group-hover:scale-110 transition-transform duration-300">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                          </svg>
                        </div>
                        <span className="absolute top-2 start-2 text-[8px] font-black px-1.5 py-0.5 rounded bg-black/60 text-white uppercase tracking-wider">
                          {qualityTag}
                        </span>
                        <span className="absolute bottom-2 end-2 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-medium">
                          {durationMin}:00
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-xs font-bold text-[var(--t1)] truncate">{rec.room_name || rec.room_code}</h4>
                        <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5 truncate">{isFarsi ? "توسط" : "By"} {rec.owner_full_name}</p>
                      </div>
                      <div className="flex justify-end border-t border-[var(--b)] pt-3 mt-1">
                        <Link to={`/recordings/${rec.public_token}`} className="text-[11px] font-bold text-[var(--brand)] hover:underline no-underline">
                          {isFarsi ? "مشاهده فیلم ضبط‌شده" : "Watch Recording"} →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modals for Create/Join Org (Embedded for quick setup) */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                <h3 className="text-lg font-bold text-[var(--t1)]">
                  {isFarsi ? "ایجاد سازمان جدید" : "Create New Organization"}
                </h3>
                {errorMsg && (
                  <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <Input
                    label={isFarsi ? "نام سازمان" : "Organization Name"}
                    placeholder={isFarsi ? "آکادمی من" : "My Academy"}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowCreateModal(false);
                        setErrorMsg("");
                      }}
                      disabled={isSubmitting}
                    >
                      {isFarsi ? "لغو" : "Cancel"}
                    </Button>
                    <Button type="submit" loading={isSubmitting}>
                      {isFarsi ? "ایجاد" : "Create"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showJoinModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                <h3 className="text-lg font-bold text-[var(--t1)]">
                  {isFarsi ? "پیوستن به سازمان" : "Join Organization"}
                </h3>
                {errorMsg && (
                  <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}
                <form onSubmit={handleJoinOrg} className="space-y-4">
                  <Input
                    label={isFarsi ? "شناسه یا اسلاگ سازمان" : "Organization ID or Slug"}
                    placeholder={isFarsi ? "مثال: my-academy" : "e.g., my-academy"}
                    value={orgCodeOrSlug}
                    onChange={(e) => setOrgCodeOrSlug(e.target.value)}
                    required
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowJoinModal(false);
                        setErrorMsg("");
                      }}
                      disabled={isSubmitting}
                    >
                      {isFarsi ? "لغو" : "Cancel"}
                    </Button>
                    <Button type="submit" loading={isSubmitting}>
                      {isFarsi ? "پیوستن" : "Join"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      <div className="flex flex-col gap-5 md:gap-6 fade-in">
        {/* Live Now Banner */}
        {liveSession && (
          <div className="relative overflow-hidden bg-gradient-to-r from-red-500/10 to-[var(--brand)]/10 border border-red-500/20 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                🔴
              </div>
              <div>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                  {isFarsi ? "کلاس زنده در حال برگزاری است" : "Active Class Live Now"}
                </span>
                <h3 className="text-md font-extrabold text-[var(--t1)] mt-1">{liveSession.title}</h3>
                <p className="text-xs text-[var(--t2)] mt-0.5">
                  {liveSession.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {liveSession.host_name}
                </p>
              </div>
            </div>
            <Link
              to={`/room/${liveSession.active_room_code}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              {isFarsi ? "ورود به کلاس" : "Join Class"}
            </Link>
          </div>
        )}

        {/* Greeting & Info card */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--brand)]/5 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-xl md:text-2xl font-bold text-[var(--t1)]">
            {greeting()}, {user?.full_name || user?.username} 👋
          </h2>
          <p className="text-sm text-[var(--t2)] mt-1">
            {t("role")}:{" "}
            <span className="text-[var(--brand-text)] font-semibold capitalize">
              {activeRole}
            </span>
          </p>
        </div>

        {/* Next Up Session Hero */}
        {nextSession && (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[var(--brand)]/15 transition-all duration-300" />
            <div className="flex items-start gap-4 z-10">
              <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-xl font-bold">
                📅
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--brand-text)] uppercase tracking-wider">
                  {isFarsi ? "جلسه بعدی شما" : "Your Next Session"}
                </span>
                <h3 className="text-base font-extrabold text-[var(--t1)] mt-1">{nextSession.title}</h3>
                <p className="text-xs text-[var(--t2)] mt-0.5">
                  {nextSession.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {nextSession.host_name}
                </p>
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-1.5 z-10 self-stretch md:self-auto border-t md:border-none border-[var(--b)] pt-3 md:pt-0 mt-1 md:mt-0">
              <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider">
                {isFarsi ? "زمان باقی‌مانده" : "Time Remaining"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-500 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {countdownText}
                </span>
                <Link to={`/academic/sessions/${nextSession.id}`}>
                  <button className="p-2 rounded-lg bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] text-[var(--t1)] transition-all cursor-pointer">
                    <ChevronRight className="w-4 h-4 transform rtl:rotate-180" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Needs Attention Widget (Teacher/Admin only) */}
        {(activeRole === "teacher" || activeRole === "admin") && pendingSubmissions.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                ⚠️
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  {isFarsi ? "اقدام لازم" : "Needs Attention"}
                </span>
                <h3 className="text-md font-extrabold text-[var(--t1)] mt-1">
                  {isFarsi
                    ? `${pendingSubmissions.length} پاسخ تکلیف در انتظار بررسی و نمره‌دهی است.`
                    : `You have ${pendingSubmissions.length} homework submission${pendingSubmissions.length > 1 ? "s" : ""} pending review.`}
                </h3>
              </div>
            </div>
            <Link
              to={`/academic/assignments/${pendingSubmissions[0].assignment}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              {isFarsi ? "تصحیح تکالیف" : "Grade Now"}
            </Link>
          </div>
        )}

        {/* Pending Homework Widget (Student only) */}
        {activeRole === "student" && pendingAssignments.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                📝
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  {isFarsi ? "تکالیف انجام نشده" : "Pending Homework"}
                </span>
                <h3 className="text-md font-extrabold text-[var(--t1)] mt-1">
                  {isFarsi
                    ? `شما ${pendingAssignments.length} تکلیف انجام نشده دارید که باید تحویل دهید.`
                    : `You have ${pendingAssignments.length} assignment${pendingAssignments.length > 1 ? "s" : ""} pending submission.`}
                </h3>
              </div>
            </div>
            <Link
              to={`/academic/assignments/${pendingAssignments[0].id}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              {isFarsi ? "ارسال پاسخ" : "Submit Now"}
            </Link>
          </div>
        )}

        {/* Quick actions (Role-Aware) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {canManageCRM ? (
            /* Admin / Teacher Actions */
            <>
              <button
                onClick={() =>
                  createRoom({
                    name: t("roomDefault", {
                      name: user?.full_name || user?.username || "",
                    }),
                    max_participants: 20,
                    is_recorded: false,
                  })
                }
                disabled={roomLoading}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none disabled:opacity-50 group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "شروع تماس" : "Start Call"}
                </span>
              </button>

              <button
                onClick={() => navigate("/academic/sessions")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "برنامه‌ریزی جلسه" : "Schedule Session"}
                </span>
              </button>

              <button
                onClick={() => navigate("/academic/classes")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 text-[var(--green)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "ایجاد تکلیف جدید" : "Create Homework"}
                </span>
              </button>

              <button
                onClick={() => navigate("/finance/ledger")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "دفتر مالی" : "Financial Ledger"}
                </span>
              </button>
            </>
          ) : (
            /* Student / Personal Actions */
            <>
              <button
                onClick={() =>
                  createRoom({
                    name: isFarsi
                      ? `تماس ${user?.full_name || user?.username || ""}`
                      : `Call by ${user?.full_name || user?.username || ""}`,
                    max_participants: 20,
                    is_recorded: false,
                  })
                }
                disabled={roomLoading}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none disabled:opacity-50 group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center font-medium">
                  {isFarsi ? "شروع تماس" : "Start Call"}
                </span>
              </button>


              {!!activeOrg && (
                <button
                  onClick={() => navigate("/academic/homework")}
                  className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 text-[var(--green)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--t2)] text-center font-medium">
                    {isFarsi ? "تکالیف من" : "My Homework"}
                  </span>
                </button>
              )}

              <button
                onClick={() => navigate("/recordings")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Play className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center font-medium">
                  {isFarsi ? "ضبط تماس‌ها" : "Recordings"}
                </span>
              </button>

              {!!activeOrg && (
                <button
                  onClick={() => navigate("/academic/payments")}
                  className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--t2)] text-center font-medium">
                    {isFarsi ? "پرداخت‌های من" : "My Payments"}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Overview Stats Dashboard */}
        {!activeOrg ? (
          /* Guest/No Organization Dashboard View */
          <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto w-full pt-4">
            <div className="bg-gradient-to-br from-[var(--s2)] to-[var(--s1)] border border-[var(--b)] rounded-3xl p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand)]/5 rounded-full blur-3xl pointer-events-none" />
              <div className="w-20 h-20 bg-[var(--brand)]/10 text-[var(--brand)] rounded-2xl flex items-center justify-center mx-auto text-3xl font-bold shadow-md animate-bounce">
                🏫
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h3 className="text-xl md:text-2xl font-black text-[var(--t1)] tracking-tight">
                  {isFarsi ? "به EduSpace خوش آمدید!" : "Welcome to EduSpace!"}
                </h3>
                <p className="text-sm text-[var(--t3)] leading-relaxed">
                  {isFarsi
                    ? "شما در حال حاضر عضو هیچ سازمانی نیستید. برای شروع می‌توانید یک سازمان جدید بسازید یا با استفاده از شناسه آکادمی به یک سازمان موجود بپیوندید."
                    : "You are not a member of any organization yet. To get started, you can create a new organization or join an existing one using an academy slug/ID."}
                </p>
              </div>

              {/* Call to Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto pt-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex flex-col items-center gap-3 p-6 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group"
                >
                  <span className="text-3xl">✨</span>
                  <div className="text-center">
                    <h4 className="text-xs font-bold text-[var(--t1)]">
                      {isFarsi ? "ایجاد سازمان جدید" : "Create Organization"}
                    </h4>
                    <p className="text-[10px] text-[var(--t3)] mt-1">
                      {isFarsi ? "آکادمی خود را راه اندازی کنید" : "Setup your own academy"}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex flex-col items-center gap-3 p-6 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/50 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] group"
                >
                  <span className="text-3xl">🔑</span>
                  <div className="text-center">
                    <h4 className="text-xs font-bold text-[var(--t1)]">
                      {isFarsi ? "پیوستن به سازمان" : "Join Organization"}
                    </h4>
                    <p className="text-[10px] text-[var(--t3)] mt-1">
                      {isFarsi ? "با استفاده از کد به سازمان ملحق شوید" : "Join using academy ID/slug"}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Pending Invitations list */}
            {invitations.length > 0 && (
              <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-md">
                <div className="p-4 border-b border-[var(--b)]">
                  <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                    {isFarsi ? "دعوت‌نامه‌های در انتظار" : "Pending Invitations"}
                  </h3>
                </div>
                <div className="divide-y divide-[var(--b)]">
                  {invitations.map((invite: any) => (
                    <div key={invite.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[var(--s3)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-xl font-bold">
                          📩
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[var(--t1)]">
                            {invite.organization.name}
                          </h4>
                          <p className="text-xs text-[var(--t3)] mt-0.5">
                            {isFarsi
                              ? `نقش: ${invite.role || "دانشجو"} • دعوت شده توسط: ${invite.invited_by || "سیستم"}`
                              : `Role: ${invite.role || "Student"} • Invited by: ${invite.invited_by || "System"}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => handleRespondInvite(invite.organization.slug, "decline")}
                          className="px-4 py-2 text-xs font-semibold text-[var(--red)] hover:bg-[var(--red)]/10 rounded-xl"
                        >
                          {isFarsi ? "رد کردن" : "Decline"}
                        </Button>
                        <Button
                          onClick={() => handleRespondInvite(invite.organization.slug, "accept")}
                          className="px-4 py-2 text-xs font-bold rounded-xl"
                        >
                          {isFarsi ? "پذیرفتن" : "Accept"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isDataLoading ? (
          <div className="p-12 flex justify-center"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Financial Chart Card (Only visible to Admins/Financial role) */}
            {canManageFinance && (
              <div className="bg-[var(--s2)] rounded-xl p-5 border border-[var(--b)] col-span-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                      {isFarsi ? "روند مالی (۶ ماه گذشته)" : "Financial Trends (Past 6 Months)"}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] mt-0.5">
                      {isFarsi ? "درآمد در مقابل هزینه‌ها" : "Revenue vs. Expenses"}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] inline-block" />
                      <span className="text-[var(--t2)] font-medium">
                        {isFarsi ? "درآمد" : "Revenue"}: ${totalRevenue.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--red)] inline-block" />
                      <span className="text-[var(--t2)] font-medium">
                        {isFarsi ? "هزینه‌ها" : "Expenses"}: ${totalExpense.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative w-full overflow-x-auto scrollbar-none">
                  <div className="min-w-[580px] h-[240px]">
                    <svg className="w-full h-full" viewBox="0 0 600 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--red)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--red)" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Gridlines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = 210 - ratio * 190;
                        return (
                          <g key={idx}>
                            <line
                              x1="50"
                              y1={y}
                              x2="580"
                              y2={y}
                              stroke="var(--b)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                            <text
                              x="42"
                              y={y + 3.5}
                              fill="var(--t3)"
                              fontSize="9"
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              ${Math.round(ratio * roundMaxVal)}
                            </text>
                          </g>
                        );
                      })}

                      {/* X Axis labels */}
                      {chartData.map((d, idx) => {
                        const x = getX(idx);
                        return (
                          <text
                            key={idx}
                            x={x}
                            y="230"
                            fill="var(--t2)"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {d.label}
                          </text>
                        );
                      })}

                      {/* Area paths */}
                      <path d={revenueArea} fill="url(#revenueGrad)" />
                      <path d={expenseArea} fill="url(#expenseGrad)" />

                      {/* Line paths */}
                      <path
                        d={revenuePath}
                        fill="none"
                        stroke="var(--green)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={expensePath}
                        fill="none"
                        stroke="var(--red)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Points */}
                      {chartData.map((d, idx) => {
                        const rx = getX(idx);
                        const ry = getY(d.revenue);
                        const ex = getX(idx);
                        const ey = getY(d.expense);
                        return (
                          <g key={idx}>
                            {/* Revenue point */}
                            <circle
                              cx={rx}
                              cy={ry}
                              r="4"
                              fill="var(--s2)"
                              stroke="var(--green)"
                              strokeWidth="2"
                            />
                            <text
                              x={rx}
                              y={ry - 8}
                              fill="var(--green)"
                              fontSize="8"
                              fontWeight="semibold"
                              textAnchor="middle"
                            >
                              {d.revenue > 0 ? `$${Math.round(d.revenue)}` : ""}
                            </text>

                            {/* Expense point */}
                            <circle
                              cx={ex}
                              cy={ey}
                              r="4"
                              fill="var(--s2)"
                              stroke="var(--red)"
                              strokeWidth="2"
                            />
                            <text
                              x={ex}
                              y={ey - 8}
                              fill="var(--red)"
                              fontSize="8"
                              fontWeight="semibold"
                              textAnchor="middle"
                            >
                              {d.expense > 0 ? `$${Math.round(d.expense)}` : ""}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Courses & Classes (Admins/Teachers) */}
            {canManageCRM && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                  {isFarsi ? "دوره‌ها و کلاس‌ها" : "Courses & Classes"}
                </h3>
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <div className="text-2xl font-bold text-[var(--t1)]">{courses.length}</div>
                    <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "تعداد کل دوره‌ها" : "Total Courses"}</div>
                  </div>
                  <div className="h-8 w-px bg-[var(--b)]" />
                  <div>
                    <div className="text-2xl font-bold text-[var(--t1)]">{classes.length}</div>
                    <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "کلاس‌های فعال" : "Active Classes"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Enrollments */}
            {canManageCRM && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                  {isFarsi ? "ثبت‌نام‌ها" : "Enrollments"}
                </h3>
                <div className="flex items-baseline gap-2 mt-3">
                  <div className="text-3xl font-bold text-[var(--t1)]">{enrollments.length}</div>
                  <div className="text-xs text-[var(--green)]">
                    {isFarsi ? "ثبت‌نام فعال" : "Active student enrollments"}
                  </div>
                </div>
              </div>
            )}

            {/* Student-specific Stats */}
            {activeRole === "student" && (
              <>
                {/* Enrolled Classes */}
                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "کلاس‌های من" : "My Classes"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">{enrolledClassIds.length}</div>
                    <div className="text-xs text-[var(--brand-text)] font-semibold">
                      {isFarsi ? "کلاس فعال" : "active classes"}
                    </div>
                  </div>
                </div>

                {/* Pending Homework */}
                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "تکالیف در انتظار" : "Pending Homework"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">{pendingAssignments.length}</div>
                    <div className="text-xs text-amber-500 font-semibold">
                      {isFarsi ? "نیاز به تحویل" : "requires submission"}
                    </div>
                  </div>
                </div>

                {/* Attendance Rate */}
                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "نرخ حضور" : "Attendance Rate"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">{attendanceRate}%</div>
                    <div className="text-xs text-[var(--green)] font-semibold">
                      {isFarsi ? "حضور در جلسات" : "session attendance"}
                    </div>
                  </div>
                </div>

                {/* Outstanding Balance */}
                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "بدهی معوقه" : "Outstanding Balance"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">
                      ${studentInvoicesBalance?.outstanding?.toFixed(1) || "0.0"}
                    </div>
                    <div className="text-xs text-[var(--red)] font-semibold">
                      {isFarsi ? "فاکتورهای پرداخت نشده" : "unpaid invoices"}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Financial Balance (Admins/Financial role) */}
            {canManageFinance && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-1 md:col-span-2 lg:col-span-1">
                <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                  {isFarsi ? "تراز مالی" : "Financial Balance"}
                </h3>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--green)]">${totalRevenue.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "دریافت شده" : "Revenue"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--amber)]">${totalPendingRevenue.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "در انتظار" : "Pending"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--red)]">${totalExpense.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "هزینه‌ها" : "Expenses"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher-specific Stats */}
            {(activeRole === "teacher" || activeRole === "admin") && (
              <>
                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "ساعات تدریس" : "Taught Hours"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">{taughtHours.toFixed(1)}</div>
                    <div className="text-xs text-[var(--brand-text)] font-semibold">
                      {isFarsi ? "ساعت کلاس تکمیل‌شده" : "hrs completed sessions"}
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                  <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                    {isFarsi ? "کلاس‌های تحت تدریس" : "Classes Taught"}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-3">
                    <div className="text-3xl font-bold text-[var(--t1)]">{myTaughtClasses.length}</div>
                    <div className="text-xs text-[var(--cyan)] font-semibold">
                      {isFarsi ? "کلاس فعال" : "active classes"}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Student Grade Tracker Chart */}
            {activeRole === "student" && (
              <div className="bg-[var(--s2)] rounded-xl p-5 border border-[var(--b)] col-span-full">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                      {isFarsi ? "روند نمرات و پیشرفت تحصیلی" : "Academic Progress (Grades)"}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] mt-0.5">
                      {isFarsi ? "نمرات تکالیف نمره‌دهی شده" : "Grades of your graded assignments"}
                    </p>
                  </div>
                </div>

                {gradedAssignmentSubmissions.length === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-[var(--t3)] text-xs">
                    <span className="text-2xl">📈</span>
                    <span>{isFarsi ? "هنوز نمره‌ای برای تکالیف شما ثبت نشده است." : "No grades have been recorded yet."}</span>
                  </div>
                ) : (
                  <div className="relative w-full overflow-x-auto scrollbar-none">
                    <div className="min-w-[580px] h-[220px]">
                      <svg className="w-full h-full" viewBox="0 0 600 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="gradeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Gridlines */}
                        {[0, 25, 50, 75, 100].map((ratio) => {
                          const y = 160 - (ratio * 130) / 100;
                          return (
                            <g key={ratio}>
                              <line
                                x1="50"
                                y1={y}
                                x2="550"
                                y2={y}
                                stroke="var(--b)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                              />
                              <text
                                x="42"
                                y={y + 3.5}
                                fill="var(--t3)"
                                fontSize="9"
                                textAnchor="end"
                                fontFamily="monospace"
                              >
                                {ratio}
                              </text>
                            </g>
                          );
                        })}

                        {/* X Axis labels */}
                        {gradedAssignmentSubmissions.map((sub, idx) => {
                          const x = 50 + (idx * 500) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                          return (
                            <text
                              key={idx}
                              x={x}
                              y="185"
                              fill="var(--t2)"
                              fontSize="9"
                              textAnchor="middle"
                            >
                              {sub.assignment_title && sub.assignment_title.length > 10
                                ? sub.assignment_title.slice(0, 10) + "..."
                                : sub.assignment_title || `HW ${idx + 1}`}
                            </text>
                          );
                        })}

                        {/* Line Path */}
                        {gradedAssignmentSubmissions.length > 1 && (
                          <>
                            <path
                              d={studentPath}
                              fill="none"
                              stroke="var(--brand)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d={studentArea}
                              fill="url(#gradeGrad)"
                            />
                          </>
                        )}

                        {/* Data Points */}
                        {gradedAssignmentSubmissions.map((sub, idx) => {
                          const x = 50 + (idx * 500) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                          const val = parseFloat(sub.grade || "0");
                          const y = 160 - (val * 130) / 100;
                          return (
                            <g key={idx}>
                              <circle
                                cx={x}
                                cy={y}
                                r="4.5"
                                fill="var(--s2)"
                                stroke="var(--brand)"
                                strokeWidth="2.5"
                              />
                              <text
                                x={x}
                                y={y - 8}
                                fill="var(--brand-text)"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {val}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Live Classes List */}
            {liveSessions.length > 0 && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-full">
                <h3 className="text-xs font-semibold text-[var(--green)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] animate-pulse" />
                  {isFarsi ? "کلاس‌های زنده در حال برگزاری" : "Active Live Classes"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {liveSessions.map((s) => (
                    <div key={s.id} className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3.5 flex flex-col justify-between min-h-[120px]">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--t1)]">{s.title}</h4>
                        <p className="text-xs text-[var(--t3)] mt-1">{s.academy_class_name}</p>
                        <p className="text-[11px] text-[var(--t2)] mt-0.5">{isFarsi ? "مدرس" : "Host"}: {s.host_name}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/room/${s.active_room_code}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--green)] text-white hover:brightness-110 transition-all cursor-pointer no-underline text-center"
                        >
                          {isFarsi ? "ورود به کلاس" : "Join Room"}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Classes Horizontal Scroll (Teacher Only) */}
            {activeRole === "teacher" && (
              <div className="bg-[var(--s2)] rounded-xl p-5 border border-[var(--b)] col-span-full flex flex-col gap-4">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "کلاس‌های تحت تدریس من" : "My Classes"}
                </h3>
                {myTaughtClasses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--t3)]">
                    {isFarsi ? "شما در حال حاضر کلاسی را تدریس نمی‌کنید." : "You are not teaching any classes currently."}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 scrollbar-thin scrollbar-thumb-[var(--b)]">
                    {myTaughtClasses.map((c) => {
                      const enrollmentCount = enrollments.filter((e) => e.academy_class === c.id && e.is_active).length;
                      return (
                        <div
                          key={c.id}
                          className="min-w-[280px] md:min-w-[320px] snap-start bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] transition-all rounded-2xl p-5 flex flex-col justify-between gap-4"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)]/10 text-[var(--brand-text)] uppercase tracking-wider">
                                {c.course_code || "CLASS"}
                              </span>
                              {c.room && (
                                <span className="text-[10px] font-semibold text-[var(--t3)]">
                                  🚪 {c.room}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-extrabold text-[var(--t1)] mt-2">{c.name}</h4>
                            <p className="text-xs text-[var(--t3)] mt-1 truncate">{c.course_title}</p>
                          </div>
                          <div className="flex justify-between items-center border-t border-[var(--b)] pt-3 mt-2">
                            <span className="text-xs text-[var(--t2)] font-medium">
                              👥 {enrollmentCount} {isFarsi ? "دانشجو" : "Students"}
                            </span>
                            <Link
                              to={`/academic/classes/${c.id}`}
                              className="text-[11px] font-semibold text-[var(--brand)] hover:underline no-underline"
                            >
                              {isFarsi ? "مشاهده کلاس" : "View Class"} →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Exams Card (Student Only) */}
            {activeRole === "student" && (
              <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm col-span-full">
                <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                    {isFarsi ? "آزمون‌های پیش‌رو" : "Upcoming Exams"}
                  </h3>
                  <Link to="/academic/assessments" className="text-[10px] text-[var(--brand)] hover:underline no-underline font-semibold">
                    {isFarsi ? "مشاهده همه" : "See All"} →
                  </Link>
                </div>

                {upcomingExams.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">📝</span>
                    <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "هیچ آزمونی برنامه‌ریزی نشده است" : "No upcoming exams"}</h4>
                    <p className="text-[10px] text-[var(--t3)]">{isFarsi ? "آزمون‌های کلاسی فعال شما در این بخش نمایش داده می‌شوند." : "Class assessments will appear here."}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--b)]">
                    {upcomingExams.map((exam) => {
                      const submission = studentSubmissions.find(s => s.assessment.id === exam.id);
                      const isGraded = submission?.status === "graded";
                      const isSubmitted = submission?.status === "submitted";
                      const isStarted = submission?.status === "started";

                      return (
                        <div key={exam.id} className="p-4 hover:bg-[var(--s3)] transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-xl font-bold">
                              📝
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[var(--t1)]">{exam.title}</h4>
                              <p className="text-[10px] text-[var(--t3)] mt-0.5">
                                {exam.session_title} • {exam.duration_minutes} {isFarsi ? "دقیقه" : "mins"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isGraded ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--green)]/10 text-[var(--green)]">
                                {isFarsi ? `نمره: ${submission.score}` : `Grade: ${submission.score}`}
                              </span>
                            ) : isSubmitted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--amber)]/10 text-[var(--amber)]">
                                {isFarsi ? "تحویل داده شده" : "Submitted"}
                              </span>
                            ) : isStarted ? (
                              <Link
                                to={`/assessments/take/${submission.id}`}
                                className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[var(--brand)] text-white hover:brightness-110 transition-all cursor-pointer no-underline text-center"
                              >
                                {isFarsi ? "ادامه آزمون" : "Resume"}
                              </Link>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const sub = await assessmentsApi.startAssessment(exam.id);
                                    navigate(`/assessments/take/${sub.id}`);
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[var(--brand)] text-white hover:brightness-110 transition-all cursor-pointer no-underline text-center border-none"
                              >
                                {isFarsi ? "شروع آزمون" : "Start"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Class Recordings Shelf (Student Only) */}
            {activeRole === "student" && (
              <div className="bg-[var(--s2)] rounded-xl p-5 border border-[var(--b)] col-span-full flex flex-col gap-4">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "ویدیوهای ضبط‌شده کلاس‌های من" : "Class Recordings"}
                </h3>
                {studentRecordings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--t3)]">
                    {isFarsi ? "هیچ فایل ضبط‌شده‌ای برای شما در دسترس نیست." : "No recordings available currently."}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 scrollbar-thin scrollbar-thumb-[var(--b)]">
                    {studentRecordings.map((rec) => (
                      <div
                        key={rec.public_token}
                        className="min-w-[280px] md:min-w-[320px] snap-start bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] transition-all rounded-2xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] uppercase tracking-wider">
                              {rec.quality}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--t3)]">
                              ⏱️ {Math.round(rec.duration_seconds / 60)} {isFarsi ? "دقیقه" : "mins"}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold text-[var(--t1)] mt-2">{rec.room_name || rec.room_code}</h4>
                          <p className="text-[10px] text-[var(--t3)] mt-0.5">
                            {isFarsi ? "توسط " : "By "} {rec.owner_full_name}
                          </p>
                        </div>
                        <div className="flex justify-end border-t border-[var(--b)] pt-3 mt-2">
                          <Link
                            to={`/recordings/${rec.public_token}`}
                            className="text-[11px] font-semibold text-[var(--brand)] hover:underline no-underline"
                          >
                            {isFarsi ? "مشاهده فیلم ضبط‌شده" : "Watch Recording"} →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Sessions Agenda */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm col-span-full">
              <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "برنامه جلسات پیش‌رو" : "Upcoming Sessions"}
                </h3>
                <Link to="/academic/sessions" className="text-[10px] text-[var(--brand)] hover:underline no-underline font-semibold">
                  {isFarsi ? "مشاهده همه" : "See All"} →
                </Link>
              </div>

              {upcomingSessions.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">📭</span>
                  <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "هیچ جلسه‌ای برنامه‌ریزی نشده است" : "No upcoming sessions"}</h4>
                  <p className="text-[10px] text-[var(--t3)]">{isFarsi ? "لیست جلسات برنامه‌ریزی شده در این بخش نمایش داده می‌شود." : "Scheduled sessions will appear here."}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--b)]">
                  {upcomingSessions.map((s) => {
                    const dateVal = new Date(s.scheduled_start!);
                    return (
                      <div key={s.id} className="p-4 hover:bg-[var(--s3)] transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="px-2.5 py-1.5 rounded-lg bg-[var(--s3)] border border-[var(--b)] flex flex-col items-center justify-center min-w-[50px]">
                            <span className="text-[10px] font-bold text-[var(--brand-text)]">
                              {dateVal.toLocaleDateString(localeTag, { weekday: "short" })}
                            </span>
                            <span className="text-sm font-black text-[var(--t1)]">
                              {dateVal.getDate()}
                            </span>
                          </div>
                          <div>
                            <Link to={`/academic/sessions/${s.id}`} className="text-xs font-bold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline">
                              {s.title}
                            </Link>
                            <p className="text-[10px] text-[var(--t3)] mt-0.5">
                              {s.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {s.host_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[var(--t2)] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[var(--t3)]" />
                            {dateVal.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm col-span-full">
              <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "فعالیت‌های اخیر" : "Recent Activity"}
                </h3>
              </div>

              {recentActivity.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">📭</span>
                  <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "هیچ فعالیتی ثبت نشده است" : "No recent activity"}</h4>
                  <p className="text-[10px] text-[var(--t3)]">{isFarsi ? "رویدادها و اعلانات اخیر در این بخش نمایش داده می‌شوند." : "Your recent events and alerts will appear here."}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--b)]">
                  {recentActivity.map((item) => {
                    const formatted = getNotificationText(item);
                    return (
                      <div key={item.id} className="p-4 hover:bg-[var(--s3)] transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-lg flex-shrink-0">
                            {formatted.icon}
                          </div>
                          <div>
                            <Link to={formatted.link} className="text-xs font-bold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline">
                              {formatted.title}
                            </Link>
                            {formatted.desc && (
                              <p className="text-[10px] text-[var(--t3)] mt-0.5">
                                {formatted.desc}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-semibold text-[var(--t3)]">
                            {formatRelativeTime(item.receivedAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Academy General context info */}
            <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-full">
              <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-3">
                {isFarsi ? "اطلاعات کلی و اعضا" : "General Info & Members"}
              </h3>
              <div className="text-sm text-[var(--t2)] flex flex-col gap-2">
                <p>
                  {isFarsi
                    ? "به سیستم مدیریت آکادمی خوش آمدید. بر اساس نقش کاربری خود می‌توانید دوره‌ها، ثبت‌نام‌ها و بخش مالی را مدیریت کنید."
                    : "Welcome to the Academy CRM. Use the sidebar menu to navigate through academic classes, courses, assessments, and financial ledger statements."}
                </p>
                <div className="mt-2 p-3 bg-[var(--s3)] rounded-lg text-xs text-[var(--t3)]">
                  {isFarsi
                    ? `نقش شما: ${activeRole} | سازمان فعال: ${activeOrg?.name || "پیش‌فرض"}`
                    : `Your active role: ${activeRole} | Active organization context: ${activeOrg?.name || "default-academy"}`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals for Create/Join Org */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <h3 className="text-lg font-bold text-[var(--t1)]">
              {isFarsi ? "ایجاد سازمان جدید" : "Create New Organization"}
            </h3>
            {errorMsg && (
              <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <Input
                label={isFarsi ? "نام سازمان" : "Organization Name"}
                placeholder={isFarsi ? "آکادمی من" : "My Academy"}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setErrorMsg("");
                  }}
                  disabled={isSubmitting}
                >
                  {isFarsi ? "لغو" : "Cancel"}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isFarsi ? "ایجاد" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <h3 className="text-lg font-bold text-[var(--t1)]">
              {isFarsi ? "پیوستن به سازمان" : "Join Organization"}
            </h3>
            {errorMsg && (
              <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            <form onSubmit={handleJoinOrg} className="space-y-4">
              <Input
                label={isFarsi ? "شناسه یا اسلاگ سازمان" : "Organization ID or Slug"}
                placeholder={isFarsi ? "مثال: my-academy" : "e.g., my-academy"}
                value={orgCodeOrSlug}
                onChange={(e) => setOrgCodeOrSlug(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowJoinModal(false);
                    setErrorMsg("");
                  }}
                  disabled={isSubmitting}
                >
                  {isFarsi ? "لغو" : "Cancel"}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isFarsi ? "پیوستن" : "Join"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
