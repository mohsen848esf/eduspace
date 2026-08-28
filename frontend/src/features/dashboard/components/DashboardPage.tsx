import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Spinner from "@/components/ui/Spinner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useLocale } from "@/i18n/useLocale";
import { useOrgPermission } from "@/hooks/useOrgPermission";
import { useSessions } from "@/features/sessions/hooks/useSessions";
import { sessionsApi } from "@/features/sessions/api/sessions.api";
import { crmApi } from "../api/crm.api";
import { assessmentsApi } from "@/features/assessments/api/assessments.api";
import recordingsApi from "@/features/recordings/api/recordings.api";
import { queryKeys } from "@/lib/query-keys";
import OrgDashboardView from "./shells/OrgDashboardView";
import PersonalHomePage from "../pages/PersonalHomePage";
import CreateOrgModal from "./modals/CreateOrgModal";
import JoinOrgModal from "./modals/JoinOrgModal";

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { hasPermission, activeRole: rawActiveRole, activeOrg } = useOrgPermission();
  const [activeNav, setActiveNav] = useState("dashboard");
  const navigate = useNavigate();
  const location = useLocation();

  // Guest flow modal state
  const initialAction = new URLSearchParams(location.search).get("action");
  const [showCreateModal, setShowCreateModal] = useState(initialAction === "create-org");
  const [showJoinModal, setShowJoinModal] = useState(initialAction === "join-org");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    if (action !== "create-org" && action !== "join-org") return;
    const actionTimer = window.setTimeout(() => {
      if (action === "create-org") setShowCreateModal(true);
      if (action === "join-org") setShowJoinModal(true);
      navigate(location.pathname, { replace: true });
    }, 0);
    return () => window.clearTimeout(actionTimer);
  }, [location.search, location.pathname, navigate]);

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

  // Shared CRM Queries (Only executed when inside an organization)
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
    enabled: (hasPermission("can_teach_class") || hasPermission("can_manage_members")) && !!activeOrg,
  });

  const { data: studentAssignments = [] } = useQuery({
    queryKey: ["student-assignments"],
    queryFn: () => assessmentsApi.getAssignments(),
    enabled: hasPermission("can_attend_class") && !!activeOrg,
  });

  const { data: studentAssignmentSubmissions = [] } = useQuery({
    queryKey: ["student-assignment-submissions"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
    enabled: hasPermission("can_attend_class") && !!activeOrg,
  });

  const { data: studentRecordingsData } = useQuery({
    queryKey: queryKeys.recordings.all,
    queryFn: () => recordingsApi.list({ published: true }),
    enabled: hasPermission("can_attend_class") && !!activeOrg,
  });

  const { data: recentInvoicesData } = useQuery({
    queryKey: queryKeys.invoices.list({ page_size: 5 }),
    queryFn: () => crmApi.getInvoices({ page_size: 5 }),
    enabled: canViewFinancials && !!activeOrg,
  });

  // Calculate Real Today Sessions
  const todaySessions = allSessions.filter((s) => {
    if (!s.scheduled_start) return false;
    try {
      const sDate = new Date(s.scheduled_start);
      const today = new Date();
      return (
        sDate.getDate() === today.getDate() &&
        sDate.getMonth() === today.getMonth() &&
        sDate.getFullYear() === today.getFullYear()
      );
    } catch {
      return false;
    }
  });

  const studentRecordings = studentRecordingsData?.results || [];

  const isDataLoading =
    loadingCourses ||
    loadingClasses ||
    loadingEnrollments ||
    loadingSummary ||
    loadingSessions ||
    loadingAllSessions ||
    ((hasPermission("can_teach_class") || hasPermission("can_manage_members")) && loadingSubmissions);

  // If not inside an organization context, render PersonalHomePage (which has its own AppShell)
  if (!activeOrg) {
    return <PersonalHomePage />;
  }

  return (
    <AppShell
      title={activeOrg.name || t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      {isDataLoading ? (
        <div className="p-12 flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      ) : (
        <OrgDashboardView
          user={user}
          activeOrg={activeOrg}
          activeRole={activeRole}
          hasPermission={hasPermission}
          isFarsi={isFarsi}
          localeTag={localeTag}
          courses={courses}
          classes={classes}
          enrollments={enrollments}
          summaryData={summaryData}
          liveSessions={liveSessions}
          allSessions={allSessions}
          todaySessions={todaySessions}
          allSubmissions={allSubmissions}
          studentAssignments={studentAssignments}
          studentSubmissions={studentAssignmentSubmissions}
          studentRecordings={studentRecordings}
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
