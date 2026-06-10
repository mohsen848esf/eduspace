import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAssessments,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  usePublishAssessment,
  useStartAssessment,
  useSubmissions,
  useQuestionBanks,
  useQuestions,
} from "../hooks";
import { useSessions } from "../../sessions/hooks/useSessions";
import type { Assessment, Question } from "../types";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";

import { useOrgPermission } from "../../../hooks/useOrgPermission";

export default function AssessmentList() {
  const { hasPermission } = useOrgPermission();
  const navigate = useNavigate();

  const isTeacher = hasPermission("can_teach_class") || hasPermission("can_manage_members");

  const { data: assessments, isLoading, error } = useAssessments();
  const { data: questionBanks } = useQuestionBanks();
  const { data: questions } = useQuestions();
  const { data: sessions } = useSessions();
  const { data: allSubmissions } = useSubmissions(); // loaded for student reference

  const createMutation = useCreateAssessment();
  const updateMutation = useUpdateAssessment();
  const deleteMutation = useDeleteAssessment();
  const publishMutation = usePublishAssessment();
  const startMutation = useStartAssessment();

  // Expanded assessment submissions list
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [passingScore, setPassingScore] = useState("50.00");
  const [sessionId, setSessionId] = useState<string>("");

  // Linked questions selection
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [linkedQuestions, setLinkedQuestions] = useState<
    Array<{ question_id: number; order: number; points: string }>
  >([]);

  const handleOpenModal = (assessment: Assessment | null = null) => {
    setEditingAssessment(assessment);
    setSelectedBankId(questionBanks?.[0]?.id || null);
    if (assessment) {
      setTitle(assessment.title);
      setDescription(assessment.description);
      setDuration(assessment.duration_minutes);
      setPassingScore(assessment.passing_score);
      setSessionId(assessment.session ? String(assessment.session) : "");
      setLinkedQuestions(
        assessment.questions.map((q) => ({
          question_id: q.question.id,
          order: q.order,
          points: q.points,
        }))
      );
    } else {
      setTitle("");
      setDescription("");
      setDuration(60);
      setPassingScore("50.00");
      setSessionId("");
      setLinkedQuestions([]);
    }
    setIsOpen(true);
  };

  const handleToggleQuestion = (q: Question) => {
    const exists = linkedQuestions.some((l) => l.question_id === q.id);
    if (exists) {
      setLinkedQuestions(linkedQuestions.filter((l) => l.question_id !== q.id));
    } else {
      const maxOrder = linkedQuestions.reduce((max, l) => Math.max(max, l.order), 0);
      setLinkedQuestions([
        ...linkedQuestions,
        { question_id: q.id, order: maxOrder + 1, points: q.points },
      ]);
    }
  };

  const handleUpdatePoints = (qId: number, points: string) => {
    setLinkedQuestions(
      linkedQuestions.map((l) => (l.question_id === qId ? { ...l, points } : l))
    );
  };

  const handleUpdateOrder = (qId: number, order: number) => {
    setLinkedQuestions(
      linkedQuestions.map((l) => (l.question_id === qId ? { ...l, order } : l))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title,
      description,
      duration_minutes: duration,
      passing_score: passingScore,
      session: sessionId ? Number(sessionId) : null,
      questions: linkedQuestions,
    };

    if (editingAssessment) {
      updateMutation.mutate(
        { id: editingAssessment.id, data: payload as any },
        {
          onSuccess: () => setIsOpen(false),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => setIsOpen(false),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to permanently delete this assessment?")) {
      deleteMutation.mutate(id);
    }
  };

  const handlePublish = (id: number) => {
    if (window.confirm("Are you sure you want to publish this assessment? Students will be able to take it immediately.")) {
      publishMutation.mutate(id);
    }
  };

  const handleStartExam = (id: number) => {
    // Check if student already has started/submitted submission
    const existing = allSubmissions?.find((s) => s.assessment.id === id);
    if (existing) {
      if (existing.status === "started") {
        navigate(`/assessments/take/${existing.id}`);
      } else {
        navigate(`/assessments/results/${existing.id}`);
      }
      return;
    }

    if (window.confirm("Start assessment now? Your timer will begin immediately.")) {
      startMutation.mutate(id, {
        onSuccess: (sub) => {
          navigate(`/assessments/take/${sub.id}`);
        },
        onError: (err: any) => {
          alert(err.response?.data?.detail || "Could not start assessment.");
        },
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading assessments...</div>;
  }

  if (error) {
    return <div className="text-rose-400 py-8 text-center font-semibold">Failed to load assessments.</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Assessments & Exams</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {isTeacher
              ? "Build exams, publish to sessions, and grade student submissions"
              : "Take pending exams and review your submission feedback"}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => handleOpenModal(null)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition"
          >
            + Create Exam
          </button>
        )}
      </div>

      <div className="space-y-4">
        {assessments && assessments.length > 0 ? (
          assessments.map((assessment) => {
            // Find student's attempt for this exam
            const studentAttempt = allSubmissions?.find((s) => s.assessment.id === assessment.id);

            return (
              <div
                key={assessment.id}
                className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h3 className="font-bold text-white text-lg">{assessment.title}</h3>
                      {isTeacher && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            assessment.is_published
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 border border-slate-750 text-slate-400"
                          }`}
                        >
                          {assessment.is_published ? "Published" : "Draft"}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1 mb-3 leading-normal">
                      {assessment.description || <span className="italic text-slate-700">No description</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                      <div>
                        Duration: <span className="text-slate-350">{assessment.duration_minutes} min</span>
                      </div>
                      <div>
                        Passing Score: <span className="text-slate-350">{assessment.passing_score}%</span>
                      </div>
                      <div>
                        Questions: <span className="text-slate-350">{assessment.questions?.length || 0}</span>
                      </div>
                      {assessment.session_title && (
                        <div>
                          Session: <span className="text-indigo-400">{assessment.session_title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
                    {isTeacher ? (
                      <>
                        <button
                          onClick={() => setExpandedId(expandedId === assessment.id ? null : assessment.id)}
                          className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:text-white transition"
                        >
                          {expandedId === assessment.id ? "Hide Submissions" : "View Submissions"}
                        </button>
                        {!assessment.is_published && (
                          <button
                            onClick={() => handlePublish(assessment.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(assessment)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(assessment.id)}
                          className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-bold rounded-lg transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        {studentAttempt ? (
                          studentAttempt.status === "started" ? (
                            <button
                              onClick={() => navigate(`/assessments/take/${studentAttempt.id}`)}
                              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition"
                            >
                              Resume Attempt
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/assessments/results/${studentAttempt.id}`)}
                              className="px-5 py-2 bg-indigo-900/50 border border-indigo-850 hover:border-indigo-750 text-indigo-300 text-sm font-bold rounded-lg transition"
                            >
                              View Results ({studentAttempt.score} pts)
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleStartExam(assessment.id)}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition"
                          >
                            Start Exam
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Submissions sub-table */}
                {isTeacher && expandedId === assessment.id && (
                  <div className="border-t border-slate-900 mt-5 pt-4">
                    <SubmissionsList assessmentId={assessment.id} />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-550 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
            No assessments found.
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Modal open={isOpen} onOpenChange={setIsOpen}>
        <ModalHeader>
          <ModalTitle>{editingAssessment ? "Edit Assessment" : "Create Assessment"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <Input
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calculus Midterm"
            />

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about instructions, references allowed..."
                rows={3}
                className="w-full bg-slate-950 text-slate-200 text-sm border border-slate-850 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Duration (Minutes)"
                type="number"
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <Input
                label="Passing Score (%)"
                type="number"
                step="0.01"
                required
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Linked Session (Optional)
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-sm border border-slate-850 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">None / Floating Assessment</option>
                {sessions?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.academy_class_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Questions Association Section */}
            <div className="border-t border-slate-800 pt-4 mt-6">
              <h4 className="font-bold text-white text-sm mb-3">Link Questions</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                    Question Bank
                  </label>
                  <select
                    value={selectedBankId || ""}
                    onChange={(e) => setSelectedBankId(Number(e.target.value) || null)}
                    className="w-full bg-slate-950 text-slate-200 text-sm border border-slate-850 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Select a Bank...</option>
                    {questionBanks?.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-between bg-slate-950/20 border border-slate-850 p-3 rounded-lg text-xs font-medium text-slate-400">
                  <span>Linked Count: <b className="text-indigo-400">{linkedQuestions.length}</b></span>
                  <span>Total Weight: <b className="text-indigo-400">
                    {linkedQuestions.reduce((sum, l) => sum + parseFloat(l.points || "0"), 0).toFixed(2)} pts
                  </b></span>
                </div>
              </div>

              {/* Bank Questions Selector */}
              {selectedBankId && (
                <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-4 max-h-[220px] overflow-y-auto space-y-3">
                  {questions
                    ?.filter((q) => q.question_bank === selectedBankId && q.is_active)
                    .map((q) => {
                      const link = linkedQuestions.find((l) => l.question_id === q.id);
                      const isLinked = !!link;

                      return (
                        <div
                          key={q.id}
                          className="flex flex-col md:flex-row md:items-center justify-between border border-slate-850 bg-slate-950/30 hover:border-slate-800 p-3 rounded-lg gap-2 text-xs"
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={() => handleToggleQuestion(q)}
                              className="h-4 w-4 text-indigo-600 border-slate-800 rounded bg-slate-950 focus:ring-indigo-500"
                            />
                            <div>
                              <p className="font-semibold text-slate-200 line-clamp-1">{q.text}</p>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                {q.question_type.replace("_", " ")} | Default: {q.points} pts
                              </span>
                            </div>
                          </div>

                          {isLinked && (
                            <div className="flex items-center space-x-3 self-end md:self-auto font-mono">
                              <div className="flex items-center space-x-1.5">
                                <span>Ord:</span>
                                <input
                                  type="number"
                                  value={link.order}
                                  onChange={(e) => handleUpdateOrder(q.id, Number(e.target.value))}
                                  className="w-12 bg-slate-950 border border-slate-800 text-center rounded text-slate-200 outline-none"
                                />
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <span>Pts:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={link.points}
                                  onChange={(e) => handleUpdatePoints(q.id, e.target.value)}
                                  className="w-16 bg-slate-950 border border-slate-800 text-center rounded text-slate-200 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex space-x-3 border-t border-slate-800 pt-4 mt-6">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                Save Exam
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </div>
  );
}

// Submissions Table Helper Component for Teacher
function SubmissionsList({ assessmentId }: { assessmentId: number }) {
  const navigate = useNavigate();
  const { data: submissions, isLoading, error } = useSubmissions({ assessment_id: assessmentId });

  if (isLoading) return <div className="text-xs text-slate-500 py-2">Loading submissions...</div>;
  if (error) return <div className="text-xs text-rose-500 py-2">Failed to load student submissions.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-450 border-collapse">
        <thead>
          <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase">
            <th className="py-2.5 px-3">Student</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Start Time</th>
            <th className="py-2.5 px-3">Score</th>
            <th className="py-2.5 px-3">Tab Losses</th>
            <th className="py-2.5 px-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions && submissions.length > 0 ? (
            submissions.map((sub) => (
              <tr key={sub.id} className="border-b border-slate-900/60 hover:bg-slate-950/20">
                <td className="py-2 px-3 font-semibold text-slate-300">{sub.student_username}</td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      sub.status === "graded"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : sub.status === "submitted"
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {sub.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-500">{new Date(sub.started_at).toLocaleString()}</td>
                <td className="py-2 px-3 font-semibold text-slate-350">{sub.score} pts</td>
                <td className="py-2 px-3 font-semibold">
                  <span className={sub.tab_focus_losses > 2 ? "text-rose-400" : "text-slate-450"}>
                    {sub.tab_focus_losses}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => navigate(`/assessments/review/${sub.id}`)}
                    className="px-2.5 py-1 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-400 font-bold border border-indigo-850 rounded text-[11px] transition"
                  >
                    Grade & Review
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="text-center py-6 text-slate-600 italic">
                No students have started this assessment yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
