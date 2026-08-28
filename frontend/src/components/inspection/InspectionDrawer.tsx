import { getApiErrorData } from "@/lib/api/errors";
import React, { useEffect, useState } from "react";
import { Drawer, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from "../layout/Drawer";
import { useLocale } from "@/i18n/useLocale";
import client from "@/lib/api/client";
import {
  X,
  User,
  BookOpen,
  Receipt,
  Calendar,
  UserCheck,
  Clock,
  ArrowLeft,
  ArrowRight,
  FileText,
} from "lucide-react";
import type { InspectionDrawerProps, InspectionEntityType } from "./types";

import StudentInspector from "./viewers/StudentInspector";
import TeacherInspector from "./viewers/TeacherInspector";
import MentorInspector from "./viewers/MentorInspector";
import CourseInspector from "./viewers/CourseInspector";
import ClassInspector from "./viewers/ClassInspector";
import SessionInspector from "./viewers/SessionInspector";
import InvoiceInspector from "./viewers/InvoiceInspector";
import AssignmentInspector from "./viewers/AssignmentInspector";
import type { OrgMember } from "@/features/auth/api/auth.api";
import type {
  AcademyClass,
  Course,
  Enrollment,
  TuitionInvoice,
} from "@/features/dashboard/types/crm.types";
import type { Attendance, Session } from "@/features/sessions/types";
import type {
  Assignment,
  AssignmentSubmission,
} from "@/features/assessments/types";
import { unwrapList, type PaginatedResponse } from "@/lib/api/pagination";
import { countMissingAssignments } from "./inspectionMetrics";

type InspectionEntityData =
  | OrgMember
  | Course
  | AcademyClass
  | Session
  | TuitionInvoice
  | Assignment;

const InspectionDrawerContent: React.FC<InspectionDrawerProps> = ({
  open,
  onOpenChange,
  entityType,
  entityId,
}) => {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [loading, setLoading] = useState(Boolean(open && entityType && entityId));
  const [data, setData] = useState<InspectionEntityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [localType, setLocalType] = useState<InspectionEntityType>(entityType);
  const [localId, setLocalId] = useState<string | number | null>(entityId);
  const [history, setHistory] = useState<
    { type: InspectionEntityType; id: string | number | null }[]
  >([]);

  const [studentEnrollments, setStudentEnrollments] = useState<Enrollment[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<TuitionInvoice[]>([]);
  const [mentorStudents, setMentorStudents] = useState<Enrollment[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(
    open && (entityType === "student" || entityType === "mentor"),
  );
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [missingAssignments, setMissingAssignments] = useState<number | null>(null);

  const navigateTo = (type: InspectionEntityType, id: string | number) => {
    if (localType && localId) {
      setHistory((prev) => [...prev, { type: localType, id: localId }]);
    }
    setLocalType(type);
    setLocalId(id);
    setData(null);
    setError(null);
    setLoading(true);
    setLoadingExtra(type === "student" || type === "mentor");
    setAttendanceRate(null);
    setMissingAssignments(null);
  };

  const navigateBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setLocalType(previous.type);
    setLocalId(previous.id);
    setData(null);
    setError(null);
    setLoading(true);
    setLoadingExtra(previous.type === "student" || previous.type === "mentor");
    setAttendanceRate(null);
    setMissingAssignments(null);
  };

  useEffect(() => {
    if (!open || !localType || !localId) return;

    const fetchEntityDetails = async () => {
      try {
        let endpoint = "";
        let match: OrgMember | undefined;
        if (localType === "student" || localType === "teacher" || localType === "mentor") {
          const res = await client.get<OrgMember[] | PaginatedResponse<OrgMember>>(
            "/auth/org-members/",
          );
          const members = unwrapList(res.data);
          match = members.find(
            (member) =>
              member.user === Number(localId) || member.id === Number(localId),
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
          endpoint = `/sessions/${localId}/`;
        } else if (localType === "invoice") {
          endpoint = `/auth/invoices/${localId}/`;
        } else if (localType === "assignment") {
          endpoint = `/assessments/assignments/${localId}/`;
        }

        if (endpoint) {
          const response = await client.get<InspectionEntityData>(endpoint);
          setData(response.data);
        }
      } catch (error: unknown) {
        setError(getApiErrorData(error)?.detail || "Failed to load entity details");
      } finally {
        setLoading(false);
      }
    };

    fetchEntityDetails();
  }, [open, localType, localId]);

  useEffect(() => {
    if (!open || !localType || !localId || !data) return;

    const fetchExtraData = async () => {
      try {
        const member = data as OrgMember;
        const userId = member.user || member.user_details?.id || localId;

        if (localType === "student") {
          try {
            const enrollRes = await client.get<
              Enrollment[] | PaginatedResponse<Enrollment>
            >(`/auth/enrollments/?student=${userId}`);
            setStudentEnrollments(unwrapList(enrollRes.data));
          } catch {
            setStudentEnrollments([]);
          }

          try {
            const invRes = await client.get<
              TuitionInvoice[] | PaginatedResponse<TuitionInvoice>
            >(`/auth/invoices/?student=${userId}`);
            setStudentInvoices(unwrapList(invRes.data));
          } catch {
            setStudentInvoices([]);
          }

          try {
            const attRes = await client.get<
              Attendance[] | PaginatedResponse<Attendance>
            >(`/sessions/attendance/?student=${userId}`);
            const attList = unwrapList(attRes.data);
            if (attList.length > 0) {
              const present = attList.filter(
                (attendance) => attendance.status === "present",
              ).length;
              setAttendanceRate(Math.round((present / attList.length) * 100));
            } else {
              setAttendanceRate(null);
            }
          } catch {
            setAttendanceRate(null);
          }

          try {
            const assignRes = await client.get<
              Assignment[] | PaginatedResponse<Assignment>
            >(`/assessments/assignments/`);
            const allAssignments = unwrapList(assignRes.data);
            const subRes = await client.get<
              AssignmentSubmission[] | PaginatedResponse<AssignmentSubmission>
            >(`/assessments/assignment-submissions/?student=${userId}`);
            const mySubs = unwrapList(subRes.data);
            setMissingAssignments(
              countMissingAssignments(allAssignments, mySubs, Number(userId)),
            );
          } catch {
            setMissingAssignments(null);
          }
        } else if (localType === "mentor") {
          try {
            const enrollRes = await client.get<
              Enrollment[] | PaginatedResponse<Enrollment>
            >(`/auth/enrollments/?mentor=${userId}`);
            setMentorStudents(unwrapList(enrollRes.data));
          } catch {
            setMentorStudents([]);
          }
        }
      } catch {
        // Extra info is progressive
      } finally {
        setLoadingExtra(false);
      }
    };

    fetchExtraData();
  }, [open, localType, localId, data]);

  const getHeaderIcon = () => {
    switch (localType) {
      case "student":
        return <User className="w-5 h-5 text-indigo-400" />;
      case "teacher":
        return <UserCheck className="w-5 h-5 text-emerald-400" />;
      case "mentor":
        return <User className="w-5 h-5 text-sky-400" />;
      case "course":
        return <BookOpen className="w-5 h-5 text-purple-400" />;
      case "class":
        return <Calendar className="w-5 h-5 text-blue-400" />;
      case "session":
        return <Clock className="w-5 h-5 text-amber-400" />;
      case "invoice":
        return <Receipt className="w-5 h-5 text-pink-400" />;
      case "assignment":
        return <FileText className="w-5 h-5 text-amber-400" />;
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (localType) {
      case "student":
        return isFarsi ? "مشخصات دانشجو" : "Student Details";
      case "teacher":
        return isFarsi ? "مشخصات مدرس" : "Teacher Details";
      case "mentor":
        return isFarsi ? "مشخصات منتور" : "Mentor Details";
      case "course":
        return isFarsi ? "مشخصات دوره" : "Course Details";
      case "class":
        return isFarsi ? "مشخصات کلاس" : "Class Details";
      case "session":
        return isFarsi ? "مشخصات جلسه" : "Session Details";
      case "invoice":
        return isFarsi ? "مشخصات فاکتور" : "Invoice Details";
      case "assignment":
        return isFarsi ? "مشخصات تکلیف" : "Assignment Details";
      default:
        return isFarsi ? "بررسی هوشمند" : "Inspection";
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-6 p-4 animate-pulse text-left">
          <div className="flex items-center gap-4 border-b border-[var(--b)] pb-5">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-3 bg-slate-800 rounded w-1/4" />
            <div className="grid grid-cols-2 gap-4 bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
              <div className="h-4 bg-slate-800 rounded" />
              <div className="h-4 bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
    }

    if (!data) return null;

    switch (localType) {
      case "student":
        return (
          <StudentInspector
            data={data as OrgMember}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            studentEnrollments={studentEnrollments}
            studentInvoices={studentInvoices}
            attendanceRate={attendanceRate}
            missingAssignments={missingAssignments}
            loadingExtra={loadingExtra}
            onOpenChange={onOpenChange}
          />
        );
      case "teacher":
        return (
          <TeacherInspector
            data={data as OrgMember}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      case "mentor":
        return (
          <MentorInspector
            data={data as OrgMember}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            mentorStudents={mentorStudents}
            loadingExtra={loadingExtra}
          />
        );
      case "course":
        return (
          <CourseInspector
            data={data as Course}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      case "class":
        return (
          <ClassInspector
            data={data as AcademyClass}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      case "session":
        return (
          <SessionInspector
            data={data as Session}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      case "invoice":
        return (
          <InvoiceInspector
            data={data as TuitionInvoice}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      case "assignment":
        return (
          <AssignmentInspector
            data={data as Assignment}
            isFarsi={isFarsi}
            onNavigate={navigateTo}
            onOpenChange={onOpenChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="end"
      panelClassName="w-80 max-w-[90vw] md:w-96"
    >
      <DrawerHeader className="border-b border-[var(--b)] p-4 flex items-center justify-between bg-[var(--s2)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {history.length > 0 && (
            <button
              onClick={navigateBack}
              className="p-1.5 -ms-1 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] transition-colors cursor-pointer border-none bg-transparent"
              title={isFarsi ? "بازگشت" : "Back"}
            >
              {isFarsi ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
          )}
          {getHeaderIcon()}
          <DrawerTitle className="text-sm font-bold text-[var(--t1)] truncate">
            {getHeaderTitle()}
          </DrawerTitle>
        </div>
        <DrawerClose asChild>
          <button className="p-1 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] transition-colors cursor-pointer border-none bg-transparent">
            <X className="w-4 h-4" />
          </button>
        </DrawerClose>
      </DrawerHeader>
      <DrawerBody className="bg-[var(--s1)]">{renderContent()}</DrawerBody>
    </Drawer>
  );
};

export const InspectionDrawer: React.FC<InspectionDrawerProps> = (props) => (
  <InspectionDrawerContent
    key={`${props.open}:${props.entityType ?? "none"}:${props.entityId ?? "none"}`}
    {...props}
  />
);

export default InspectionDrawer;
