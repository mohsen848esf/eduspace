import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { assessmentsApi } from "../../assessments/api/assessments.api";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/Button";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import { useLocale } from "../../../i18n/useLocale";
import { FileText, Calendar, Paperclip, CheckCircle, AlertTriangle, Send } from "lucide-react";

export default function HomeworkPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"assigned" | "submitted" | "graded" | "overdue">("assigned");
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);

  // Queries
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["all-assignments-student"],
    queryFn: () => assessmentsApi.getAssignments(),
  });

  const { data: mySubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ["my-assignment-submissions"],
    queryFn: () => assessmentsApi.getAssignmentSubmissions(),
  });

  // Submit Homework Mutation
  const submitHomeworkMutation = useMutation({
    mutationFn: (formData: FormData) => assessmentsApi.createAssignmentSubmission(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-assignment-submissions"] });
      toast.success(isFarsi ? "پاسخ تکلیف با موفقیت ارسال شد" : "Homework submitted successfully");
      setIsSubmitOpen(false);
      setSubmissionText("");
      setSubmissionFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ارسال پاسخ" : "Failed to submit homework"));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    const formData = new FormData();
    formData.append("assignment", selectedAssignment.toString());
    formData.append("submission_text", submissionText);
    if (submissionFile) {
      formData.append("submission_file", submissionFile);
    }

    submitHomeworkMutation.mutate(formData);
  };

  const now = new Date();

  // Categorize
  const assigned = assignments.filter(a => {
    const isSub = mySubmissions.some(sub => sub.assignment === a.id);
    if (isSub) return false;
    if (!a.due_date) return true;
    return new Date(a.due_date) >= now;
  });

  const submitted = assignments.filter(a => {
    const sub = mySubmissions.find(sub => sub.assignment === a.id);
    return sub && sub.status === "submitted";
  });

  const graded = assignments.filter(a => {
    const sub = mySubmissions.find(sub => sub.assignment === a.id);
    return sub && sub.status === "graded";
  });

  const overdue = assignments.filter(a => {
    const isSub = mySubmissions.some(sub => sub.assignment === a.id);
    if (isSub) return false;
    if (!a.due_date) return false;
    return new Date(a.due_date) < now;
  });

  const getActiveList = () => {
    switch (activeTab) {
      case "assigned": return assigned;
      case "submitted": return submitted;
      case "graded": return graded;
      case "overdue": return overdue;
      default: return [];
    }
  };

  const activeList = getActiveList();
  const isLoading = loadingAssignments || loadingSubmissions;

  return (
    <AppShell title={isFarsi ? "تکالیف و کار خانگی" : "My Homework"}>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 bg-[var(--s2)] p-1.5 rounded-xl border border-[var(--b)] shadow-sm">
          {(["assigned", "submitted", "graded", "overdue"] as const).map((tab) => {
            const count = tab === "assigned" ? assigned.length 
                        : tab === "submitted" ? submitted.length
                        : tab === "graded" ? graded.length
                        : overdue.length;
            
            const labels = {
              assigned: isFarsi ? "اختصاص داده شده" : "Assigned",
              submitted: isFarsi ? "تحویل داده شده" : "Submitted",
              graded: isFarsi ? "نمره‌دهی شده" : "Graded",
              overdue: isFarsi ? "منقضی شده" : "Overdue"
            };

            const colors = {
              assigned: "border-[var(--brand)] text-[var(--brand-text)]",
              submitted: "border-sky-500 text-sky-500",
              graded: "border-emerald-500 text-emerald-500",
              overdue: "border-rose-500 text-rose-500"
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-all duration-150 whitespace-nowrap bg-transparent flex items-center gap-2 ${
                  activeTab === tab 
                    ? colors[tab]
                    : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
                }`}
              >
                <span>{labels[tab]}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? "bg-[var(--brand)]/15" : "bg-[var(--s3)]"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center p-16"><Spinner /></div>
        ) : activeList.length === 0 ? (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-16 text-center shadow-sm">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-sm font-bold text-[var(--t1)]">
              {isFarsi ? "هیچ تکلیفی در این بخش وجود ندارد" : "No assignments in this section"}
            </h3>
            <p className="text-xs text-[var(--t3)] mt-1">
              {isFarsi ? "تکالیف خود را بر اساس دسته‌بندی بالا پیگیری کنید." : "Keep track of your course works using the categories above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeList.map((assignment) => {
              const submission = mySubmissions.find((s) => s.assignment === assignment.id);
              return (
                <div 
                  key={assignment.id} 
                  className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-5 hover:border-[var(--brand)]/40 transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-md relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand)]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[var(--brand)]/10 transition-all" />
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-[var(--brand-text)] uppercase tracking-wider block">
                        {assignment.class_name || "Academy Class"}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--t1)] mt-0.5 truncate">{assignment.title}</h4>
                      <p className="text-xs text-[var(--t3)] line-clamp-2 mt-1">{assignment.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--b)] pt-3 mt-1">
                    <div className="flex flex-wrap gap-4 items-center justify-between text-[11px] text-[var(--t3)]">
                      {assignment.due_date && (
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {isFarsi ? "مهلت:" : "Due:"} {new Date(assignment.due_date).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                        </span>
                      )}
                      {assignment.attachment && (
                        <a 
                          href={assignment.attachment} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[var(--brand-text)] hover:underline no-underline font-semibold flex items-center gap-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {isFarsi ? "فایل پیوست" : "Attachment"}
                        </a>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      {/* Submission status feedback */}
                      <div>
                        {submission?.status === "graded" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--green)]/15 text-[var(--green)]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {isFarsi ? `نمره: ${submission.grade} از ۱۰۰` : `Grade: ${submission.grade}/100`}
                          </span>
                        )}
                        {submission?.status === "submitted" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-500">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {isFarsi ? "ارسال شده" : "Submitted"}
                          </span>
                        )}
                        {activeTab === "overdue" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {isFarsi ? "تاخیر در تحویل" : "Overdue"}
                          </span>
                        )}
                      </div>

                      {/* Submit action */}
                      {!submission && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedAssignment(assignment.id);
                            setIsSubmitOpen(true);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          {isFarsi ? "تحویل پاسخ" : "Submit Answer"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Submit Homework Modal ── */}
      <Modal open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <ModalHeader>
          <ModalTitle>{isFarsi ? "ارسال پاسخ تکلیف" : "Submit Assignment Answer"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "توضیحات پاسخ" : "Answer Text"}
              </label>
              <textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors min-h-[120px]"
                placeholder={isFarsi ? "پاسخ یا توضیحات تکمیلی خود را بنویسید..." : "Write your response details..."}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "فایل پیوست پاسخ (اختیاری)" : "Attachment File (Optional)"}
              </label>
              <input
                type="file"
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
                className="w-full text-xs text-[var(--t2)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--brand)]/15 file:text-[var(--brand-text)] hover:file:bg-[var(--brand)]/25 file:cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsSubmitOpen(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitHomeworkMutation.isPending}>
                {submitHomeworkMutation.isPending ? (isFarsi ? "در حال ارسال..." : "Submitting...") : (isFarsi ? "ارسال" : "Submit")}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

    </AppShell>
  );
}
