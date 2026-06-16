import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { assessmentsApi } from "../api/assessments.api";
import { crmApi } from "../../dashboard/api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { useAuthStore } from "../../auth/store/authStore";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import { FileText, Calendar, Download, CheckCircle, Clock, Award, ShieldAlert, ArrowLeft } from "lucide-react";

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isFarsi = language === "fa";
  const id = parseInt(assignmentId || "0");

  const isAdmin = hasPermission("can_manage_members");
  const isTeacher = hasPermission("can_teach_class");

  // ── Queries ─────────────────────────────────────────────────────
  const { data: assignment, isLoading: loadingAssignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => assessmentsApi.getAssignment(id),
  });

  const { data: submissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ["assignment-submissions-all", id],
    queryFn: () => assessmentsApi.getAssignmentSubmissions({ assignment_id: id }),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
    enabled: !!assignment,
  });

  const isInstructor = isAdmin || isTeacher;

  // Total enrolled students in the class
  const classEnrollments = enrollments.filter(
    (e) => e.academy_class === assignment?.academy_class && e.is_active
  );

  // ── Student-specific states & mutations ──────────────────────────
  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);

  const studentSubmission = submissions.find((s) => s.student === user?.id);

  const submitMutation = useMutation({
    mutationFn: (formData: FormData) => assessmentsApi.createAssignmentSubmission(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions-all", id] });
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignment?.academy_class] });
      toast.success(isFarsi ? "پاسخ تکلیف با موفقیت ارسال شد" : "Submission successful!");
      setIsSubmitOpen(false);
      setSubmissionText("");
      setSubmissionFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ارسال پاسخ" : "Failed to submit assignment"));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("assignment", id.toString());
    formData.append("submission_text", submissionText);
    if (submissionFile) {
      formData.append("submission_file", submissionFile);
    }
    submitMutation.mutate(formData);
  };

  // ── Teacher grading states & mutations ───────────────────────────
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [grade, setGrade] = useState("100");
  const [feedback, setFeedback] = useState("");

  const gradeMutation = useMutation({
    mutationFn: ({ subId, data }: { subId: number; data: { grade: number; feedback: string } }) =>
      assessmentsApi.gradeAssignmentSubmission(subId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions-all", id] });
      toast.success(isFarsi ? "نمره با موفقیت ثبت شد" : "Submission graded successfully!");
      setIsGradingOpen(false);
      setSelectedSubmission(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت نمره" : "Failed to save grade"));
    }
  });

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    gradeMutation.mutate({
      subId: selectedSubmission.id,
      data: {
        grade: parseFloat(grade),
        feedback,
      }
    });
  };

  const openGradingModal = (sub: any) => {
    setSelectedSubmission(sub);
    setGrade(sub.grade || "100");
    setFeedback(sub.feedback || "");
    setIsGradingOpen(true);
  };

  // ── Loading state ───────────────────────────────────────────────
  if (loadingAssignment) {
    return (
      <AppShell title="...">
        <div className="flex justify-center p-16"><Spinner /></div>
      </AppShell>
    );
  }

  if (!assignment) {
    return (
      <AppShell title={isFarsi ? "تکلیف یافت نشد" : "Assignment Not Found"}>
        <div className="p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-[var(--t3)] mb-4">{isFarsi ? "تکلیف آموزشی مورد نظر وجود ندارد." : "This assignment does not exist."}</p>
          <Link to="/academic/classes"><Button variant="secondary">{isFarsi ? "بازگشت به کلاس‌ها" : "Go to Classes"}</Button></Link>
        </div>
      </AppShell>
    );
  }

  // Statistics
  const totalEnrolled = classEnrollments.length;
  const totalSubmitted = submissions.length;
  const totalGraded = submissions.filter((s) => s.status === "graded").count || submissions.filter((s) => s.status === "graded").length;

  return (
    <AppShell title={assignment.title}>
      <div className="flex flex-col gap-6">

        {/* ── Breadcrumb & Back button ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
            <Link to={`/academic/classes/${assignment.academy_class}`} className="hover:text-[var(--brand)] transition-colors flex items-center gap-1 no-underline">
              <ArrowLeft className="w-3.5 h-3.5" />
              {isFarsi ? "بازگشت به کلاس" : "Back to Class"}
            </Link>
            <span>/</span>
            <span className="text-[var(--t1)] font-medium">{assignment.title}</span>
          </div>
        </div>

        {/* ── Hero Info Card ── */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-xl font-bold">
                📝
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--t1)] mb-1">{assignment.title}</h1>
                <p className="text-sm text-[var(--t2)] leading-relaxed">{assignment.description}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-[var(--t3)] items-center">
                  {assignment.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {isFarsi ? "مهلت تحویل:" : "Due Date:"} {new Date(assignment.due_date).toLocaleString(isFarsi ? "fa-IR" : "en-US")}
                    </span>
                  )}
                  {assignment.attachment && (
                    <a href={assignment.attachment} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--brand-text)] hover:underline no-underline font-semibold">
                      <Download className="w-3.5 h-3.5" />
                      {isFarsi ? "دانلود فایل پیوست استاد" : "Download Instructor Attachment"}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {!isInstructor && !studentSubmission && (
              <Button onClick={() => setIsSubmitOpen(true)} className="flex items-center gap-1 flex-shrink-0">
                {isFarsi ? "ارسال پاسخ تکلیف" : "Submit Homework"}
              </Button>
            )}
          </div>
        </div>

        {/* ── Instructor Dashboard Workspace ── */}
        {isInstructor ? (
          <div className="flex flex-col gap-6">

            {/* KPI statistics widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1">
                <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "دانشجویان کلاس" : "Enrolled Students"}</span>
                <span className="text-2xl font-bold text-[var(--t1)]">{totalEnrolled}</span>
              </div>
              <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1">
                <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "پاسخ‌های تحویل شده" : "Submissions Received"}</span>
                <span className="text-2xl font-bold text-[var(--cyan)]">{totalSubmitted}</span>
              </div>
              <div className="p-5 rounded-2xl bg-[var(--s2)] border border-[var(--b)] flex flex-col gap-1">
                <span className="text-xs text-[var(--t3)] uppercase font-semibold">{isFarsi ? "نمره‌دهی شده" : "Graded Submissions"}</span>
                <span className="text-2xl font-bold text-[var(--green)]">{totalGraded} / {totalSubmitted}</span>
              </div>
            </div>

            {/* Submissions Table List */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[var(--b)]">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "لیست پاسخ‌های دانشجویان" : "Student Submissions"}
                </h3>
              </div>

              {loadingSubmissions ? (
                <div className="p-12 flex justify-center"><Spinner /></div>
              ) : submissions.length === 0 ? (
                <div className="p-12 text-center text-[var(--t3)]">
                  {isFarsi ? "هنوز هیچ دانشجویی پاسخی ارسال نکرده است." : "No student submissions received yet."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                        <th className="p-4">{isFarsi ? "دانشجو" : "Student"}</th>
                        <th className="p-4">{isFarsi ? "تاریخ تحویل" : "Submitted Date"}</th>
                        <th className="p-4">{isFarsi ? "فایل تحویلی" : "Submission File"}</th>
                        <th className="p-4">{isFarsi ? "توضیحات دانشجو" : "Notes"}</th>
                        <th className="p-4">{isFarsi ? "وضعیت نمره" : "Status & Grade"}</th>
                        <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => {
                        const isSubGraded = sub.status === "graded";
                        return (
                          <tr key={sub.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[10px] font-bold">
                                  {(sub.student_full_name || sub.student_username || "?").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-[var(--t1)]">{sub.student_full_name || sub.student_username}</div>
                                  <div className="text-[10px] text-[var(--t3)]">@{sub.student_username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-xs text-[var(--t2)]">
                              {new Date(sub.submitted_at).toLocaleString(isFarsi ? "fa-IR" : "en-US")}
                            </td>
                            <td className="p-4">
                              {sub.submission_file ? (
                                <a href={sub.submission_file} target="_blank" rel="noreferrer" className="text-xs text-[var(--brand-text)] hover:underline no-underline flex items-center gap-1 font-medium">
                                  <Download className="w-3.5 h-3.5" />
                                  {isFarsi ? "دانلود فایل" : "Download File"}
                                </a>
                              ) : "—"}
                            </td>
                            <td className="p-4 text-xs text-[var(--t2)] truncate max-w-[150px]">
                              {sub.submission_text || "—"}
                            </td>
                            <td className="p-4">
                              {isSubGraded ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--green)]/10 text-[var(--green)]">
                                  <Award className="w-3.5 h-3.5" />
                                  {sub.grade} / ۱۰۰
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--amber)]/10 text-[var(--amber)]">
                                  <Clock className="w-3.5 h-3.5" />
                                  {isFarsi ? "منتظر نمره" : "Pending Grade"}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <Button variant="secondary" size="xs" onClick={() => openGradingModal(sub)}>
                                {isSubGraded ? (isFarsi ? "ویرایش نمره" : "Edit Grade") : (isFarsi ? "ثبت نمره" : "Grade")}
                              </Button>
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
        ) : (
          /* ── Student Submission Workspace ── */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Left: Submission form or status card */}
            <div className="md:col-span-2 flex flex-col gap-4">
              {studentSubmission ? (
                <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-left">
                  <div className="flex items-center gap-2 pb-2 border-b border-[var(--b)]">
                    <CheckCircle className="w-6 h-6 text-[var(--green)]" />
                    <div>
                      <h3 className="font-bold text-[var(--t1)] text-md">{isFarsi ? "پاسخ شما با موفقیت ارسال شده است" : "Your Homework is Submitted"}</h3>
                      <p className="text-xs text-[var(--t3)]">{isFarsi ? "تحویل داده شده در: " : "Submitted on: "} {new Date(studentSubmission.submitted_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {studentSubmission.submission_file && (
                      <div>
                        <span className="block text-xs text-[var(--t3)] mb-1">{isFarsi ? "فایل ارسالی:" : "Submitted File:"}</span>
                        <a href={studentSubmission.submission_file} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--brand-text)] hover:underline no-underline flex items-center gap-1">
                          <Download className="w-4 h-4" />
                          {isFarsi ? "دانلود فایل ارسالی" : "Download Submitted File"}
                        </a>
                      </div>
                    )}
                    {studentSubmission.submission_text && (
                      <div>
                        <span className="block text-xs text-[var(--t3)] mb-1">{isFarsi ? "توضیحات شما:" : "Your Notes:"}</span>
                        <p className="text-sm text-[var(--t2)] bg-[var(--s3)] p-3 border border-[var(--b)] rounded-xl leading-relaxed">{studentSubmission.submission_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-left">
                  <div className="flex items-center gap-2 pb-2 border-b border-[var(--b)]">
                    <ShieldAlert className="w-6 h-6 text-[var(--amber)]" />
                    <div>
                      <h3 className="font-bold text-[var(--t1)] text-md">{isFarsi ? "پاسخی ارسال نشده است" : "No Submission Yet"}</h3>
                      <p className="text-xs text-[var(--t3)]">{isFarsi ? "لطفاً پاسخ خود را قبل از پایان مهلت ارسال کنید." : "Please upload your solution file below."}</p>
                    </div>
                  </div>
                  <Button onClick={() => setIsSubmitOpen(true)} className="w-full sm:w-auto self-start mt-2">
                    {isFarsi ? "شروع و ارسال پاسخ" : "Submit solution file"}
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Grade feedback sidebar widget */}
            {studentSubmission && (
              <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-left h-fit">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide border-b border-[var(--b)] pb-3">
                  {isFarsi ? "کارنامه تکلیف" : "Grading Result"}
                </h3>

                {studentSubmission.status === "graded" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[var(--green)]/15 text-[var(--green)] flex items-center justify-center text-lg font-black flex-shrink-0">
                        🏆
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--green)]">{studentSubmission.grade} / ۱۰۰</div>
                        <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "نمره‌دهی توسط استاد" : "Marked by Instructor"}</div>
                      </div>
                    </div>

                    {studentSubmission.feedback && (
                      <div className="bg-[var(--s3)] border border-[var(--b)] p-3 rounded-xl">
                        <span className="block text-[10px] text-[var(--t3)] font-bold uppercase tracking-wider mb-1">{isFarsi ? "بازخورد استاد:" : "Instructor Feedback:"}</span>
                        <p className="text-xs text-[var(--t2)] leading-relaxed italic">"{studentSubmission.feedback}"</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[var(--t3)] py-4">
                    <Clock className="w-5 h-5 animate-pulse" />
                    <span className="text-xs font-medium">{isFarsi ? "تکلیف شما هنوز نمره‌دهی نشده است." : "Awaiting review and grade from instructor."}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Teacher Grading Modal ── */}
        <Modal open={isGradingOpen} onOpenChange={setIsGradingOpen}>
          <ModalHeader>
            <ModalTitle>
              {isFarsi ? `ثبت نمره — ${selectedSubmission?.student_full_name || selectedSubmission?.student_username}` : `Grade Submission — ${selectedSubmission?.student_full_name}`}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleGradeSubmit} className="flex flex-col gap-4">
              
              {selectedSubmission?.submission_file && (
                <div className="bg-[var(--s3)] p-3 border border-[var(--b)] rounded-xl flex items-center justify-between text-xs text-left">
                  <div>
                    <span className="block text-[10px] text-[var(--t3)] font-semibold">{isFarsi ? "فایل تحویلی دانشجو:" : "Student File:"}</span>
                    <span className="font-semibold text-[var(--t1)]">{selectedSubmission.submission_file.split("/").pop()}</span>
                  </div>
                  <a href={selectedSubmission.submission_file} target="_blank" rel="noreferrer" className="text-xs text-[var(--brand-text)] hover:underline no-underline flex items-center gap-1 font-semibold">
                    <Download className="w-3.5 h-3.5" />
                    {isFarsi ? "دانلود و بررسی" : "Download File"}
                  </a>
                </div>
              )}

              {selectedSubmission?.submission_text && (
                <div className="text-xs text-left">
                  <span className="block text-[10px] text-[var(--t3)] font-semibold mb-1">{isFarsi ? "متن یا توضیحات پاسخ:" : "Student Notes:"}</span>
                  <p className="p-3 bg-[var(--s3)] border border-[var(--b)] rounded-xl text-[var(--t2)] leading-relaxed">{selectedSubmission.submission_text}</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "نمره مکتوب (۰ تا ۱۰۰)" : "Grade Score (0-100)"}
                </label>
                <div className="flex gap-4 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="flex-1 accent-[var(--brand)] cursor-pointer"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                  <Input
                    className="w-20 text-center font-bold text-md"
                    type="number"
                    min="0"
                    max="100"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "بازخورد و فیدبک آموزشی" : "Instructor Feedback"}
                </label>
                <textarea
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[100px]"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={isFarsi ? "توصیه‌ها و نقاط قوت/ضعف دانشجو..." : "Write recommendations or comments..."}
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="secondary" onClick={() => setIsGradingOpen(false)}>
                  {isFarsi ? "انصراف" : "Cancel"}
                </Button>
                <Button type="submit" disabled={gradeMutation.isPending}>
                  {gradeMutation.isPending ? (isFarsi ? "در حال ثبت..." : "Saving...") : (isFarsi ? "ثبت نمره" : "Save Grade")}
                </Button>
              </div>
            </form>
          </ModalBody>
        </Modal>

        {/* ── Student Submit Homework Modal ── */}
        <Modal open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <ModalHeader>
            <ModalTitle>{isFarsi ? "ارسال پاسخ تکلیف" : "Submit Assignment Solution"}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "توضیحات پاسخ (اختیاری)" : "Submission Text / Notes (Optional)"}
                </label>
                <textarea
                  className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[120px]"
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder={isFarsi ? "نوشتن نکات و جزئیات پاسخ..." : "Write your submission text here..."}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                  {isFarsi ? "فایل پیوست پاسخ تکلیف" : "Solution File (Required)"}
                </label>
                <input
                  type="file"
                  className="text-xs text-[var(--t3)]"
                  onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="secondary" onClick={() => setIsSubmitOpen(false)}>
                  {isFarsi ? "انصراف" : "Cancel"}
                </Button>
                <Button type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? (isFarsi ? "در حال ارسال..." : "Uploading...") : (isFarsi ? "ارسال" : "Submit Solution")}
                </Button>
              </div>
            </form>
          </ModalBody>
        </Modal>

      </div>
    </AppShell>
  );
}
