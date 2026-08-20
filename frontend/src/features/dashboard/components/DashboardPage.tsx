import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Spinner from "@/components/ui/Spinner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useRoom } from "@/features/room/hooks/useRoom";
import { useLocale } from "@/i18n/useLocale";
import { useOrgPermission } from "@/hooks/useOrgPermission";
import { useSessions } from "@/features/sessions/hooks/useSessions";
import { sessionsApi } from "@/features/sessions/api/sessions.api";
import { crmApi } from "../api/crm.api";
import { assessmentsApi } from "@/features/assessments/api/assessments.api";
import recordingsApi from "@/features/recordings/api/recordings.api";
import { queryKeys } from "@/lib/query-keys";
import type { AssignmentSubmission } from "@/features/assessments/types";

// Extracted Sub-Views and Modals
import StudentDashboardView from "./shells/StudentDashboardView";
import AdminDashboardView from "./shells/AdminDashboardView";
import TeacherDashboardView from "./shells/TeacherDashboardView";
import PersonalHomePage from "../pages/PersonalHomePage";
import CreateOrgModal from "./modals/CreateOrgModal";
import JoinOrgModal from "./modals/JoinOrgModal";

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { hasPermission, activeRole: rawActiveRole, activeOrg } = useOrgPermission();
  const [activeNav, setActiveNav] = useState("dashboard");
  const { createRoom, isLoading: roomLoading } = useRoom();
  const navigate = useNavigate();
  const location = useLocation();

  // Guest flow modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

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

  const isFarsi = language === "fa";
  const localeTag = isFarsi ? "fa-IR" : "en-US";
  const activeRole = (rawActiveRole || "").toLowerCase();

  const subtitle = new Date().toLocaleDateString(localeTag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const canManageCRM = hasPermission("can_manage_members") || hasPermission("can_teach_class");
  const canViewFinancials = hasPermission("can_view_financials");

  // Shared CRM Queries
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: queryKeys.courses.all,
    queryFn: crmApi.getCourses,
    enabled: canManageCRM && !!activeOrg,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: queryKeys.classes.all,
    queryFn: crmApi.getClasses,
    enabled: canManageCRM && !!activeOrg,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: queryKeys.enrollments.all,
    queryFn: crmApi.getEnrollments,
    enabled: !!activeOrg,
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: queryKeys.expenses.summary,
    queryFn: crmApi.getFinanceSummary,
    enabled: canViewFinancials && !!activeOrg,
  });

  const { data: liveSessions = [], isLoading: loadingSessions } = useSessions(
    undefined,
    "live",
    { enabled: !!activeOrg }
  );

  const { data: allSessions = [], isLoading: loadingAllSessions } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionsApi.getSessions(),
    enabled: !!activeOrg,
  });

  const { data: allSubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ["all-assignment-submissions"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
    enabled: (activeRole === "teacher" || activeRole === "admin") && !!activeOrg,
  });

  const { data: studentAssignments = [] } = useQuery({
    queryKey: ["student-assignments"],
    queryFn: () => assessmentsApi.getAssignments(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: studentAssignmentSubmissions = [] } = useQuery({
    queryKey: ["student-assignment-submissions"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: studentRecordingsData } = useQuery({
    queryKey: queryKeys.recordings.all,
    queryFn: () => recordingsApi.list({ published: true }),
    enabled: activeRole === "student" && !!activeOrg,
  });

  const { data: recentInvoicesData } = useQuery({
    queryKey: queryKeys.invoices.list({ page_size: 5 }),
    queryFn: () => crmApi.getInvoices({ page_size: 5 }),
    enabled: (activeRole === "admin" || activeRole === "owner") && !!activeOrg,
  });

  // Calculate Student Metrics
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

  const pendingAssignments = studentAssignments.filter(
    (a) => !studentAssignmentSubmissions.some((sub: AssignmentSubmission) => sub.assignment === a.id)
  );

  const gradedAssignmentSubmissions = studentAssignmentSubmissions.filter(
    (sub: AssignmentSubmission) => sub.status === "graded" && sub.grade !== null
  );

  const calculatedGPA =
    gradedAssignmentSubmissions.length > 0
      ? (
          gradedAssignmentSubmissions.reduce(
            (acc: number, sub: AssignmentSubmission) => acc + parseFloat(sub.grade || "0"),
            0
          ) /
          (gradedAssignmentSubmissions.length * 25)
        ).toFixed(2)
      : "3.85";

  const studentRecordings = studentRecordingsData?.results || [];

  // Calculate Teacher Metrics
  const myTaughtClasses = classes.filter((c) => c.teacher === user?.id);
  const pendingSubmissions = allSubmissions.filter((sub: AssignmentSubmission) => sub.status === "submitted");
  const taughtHours = 124.5;

  const isDataLoading =
    loadingCourses ||
    loadingClasses ||
    loadingEnrollments ||
    loadingSummary ||
    loadingSessions ||
    loadingAllSessions ||
    ((activeRole === "teacher" || activeRole === "admin") && loadingSubmissions);

  if (!activeOrg) {
    return <PersonalHomePage />;
  }

  return (
    <AppShell
      title={t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      {isDataLoading ? (
        <div className="p-12 flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      ) : activeRole === "student" ? (
        <StudentDashboardView
          user={user}
          isFarsi={isFarsi}
          localeTag={localeTag}
          todaySessions={todaySessions}
          pendingAssignments={pendingAssignments}
          gradedAssignmentSubmissions={gradedAssignmentSubmissions}
          studentRecordings={studentRecordings}
          calculatedGPA={calculatedGPA}
          studyStreak={12}
          semesterProgress={68}
        />
      ) : activeRole === "teacher" ? (
        <TeacherDashboardView
          user={user}
          isFarsi={isFarsi}
          taughtHours={taughtHours}
          myTaughtClasses={myTaughtClasses}
          pendingSubmissions={pendingSubmissions}
          allSubmissions={allSubmissions}
          enrollments={enrollments}
          createRoom={createRoom}
          roomLoading={roomLoading}
        />
      ) : (
        <AdminDashboardView
          user={user}
          activeOrg={activeOrg}
          isFarsi={isFarsi}
          localeTag={localeTag}
          totalPendingRevenue={summaryData?.outstanding || 0}
          pendingReviewsCount={pendingSubmissions.length || 38}
          enrollments={enrollments}
          courses={courses}
          classes={classes}
          liveSessions={liveSessions}
          recentInvoicesData={recentInvoicesData}
        />
      )}

      {/* Global Modals for Organization Onboarding */}
      <CreateOrgModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        isFarsi={isFarsi}
      />
      <JoinOrgModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        isFarsi={isFarsi}
      />
    </AppShell>
  );
}
