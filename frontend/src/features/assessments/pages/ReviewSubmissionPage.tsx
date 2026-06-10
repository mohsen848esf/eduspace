import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSubmission, useGradeSubmission } from "../hooks";

export default function ReviewSubmissionPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const parsedId = Number(submissionId);

  const { data: submission, isLoading, error } = useSubmission(parsedId);
  const gradeSubmissionMutation = useGradeSubmission();

  const [grades, setGrades] = useState<Record<number, { score: string; is_correct: boolean; teacher_notes: string }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  // Initialize grades state when submission loads
  useEffect(() => {
    if (submission && submission.answers) {
      const initialGrades: typeof grades = {};
      submission.answers.forEach((ans: any) => {
        initialGrades[ans.question] = {
          score: ans.score,
          is_correct: ans.is_correct,
          teacher_notes: ans.teacher_notes || "",
        };
      });
      setGrades(initialGrades);
    }
  }, [submission]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading submission details...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md text-center p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
          <p className="text-rose-400 font-bold mb-2">Error Loading Submission</p>
          <p className="text-slate-400 mb-6">Could not load attempt details. Either the ID is invalid or you do not have permission.</p>
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleGradeChange = (questionId: number, field: "score" | "is_correct" | "teacher_notes", value: any, maxPoints: number) => {
    const current = grades[questionId] || { score: "0.00", is_correct: false, teacher_notes: "" };
    const updated = { ...current, [field]: value };

    // Validate score boundary
    if (field === "score") {
      const num = parseFloat(value);
      if (isNaN(num)) {
        setValidationErrors(prev => ({ ...prev, [questionId]: "Score must be a number." }));
      } else if (num < 0) {
        setValidationErrors(prev => ({ ...prev, [questionId]: "Score cannot be negative." }));
      } else if (num > maxPoints) {
        setValidationErrors(prev => ({ ...prev, [questionId]: `Score cannot exceed max points (${maxPoints}).` }));
      } else {
        // Clear error
        setValidationErrors(prev => {
          const clone = { ...prev };
          delete clone[questionId];
          return clone;
        });
        // Auto-set is_correct to true if score equals max points
        if (num === maxPoints) {
          updated.is_correct = true;
        } else if (num === 0) {
          updated.is_correct = false;
        }
      }
    }

    setGrades(prev => ({
      ...prev,
      [questionId]: updated,
    }));
  };

  const handleGradeSubmit = () => {
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix all validation errors before submitting grades.");
      return;
    }

    if (window.confirm("Submit manual review grades? This will transition the attempt status to GRADED.")) {
      gradeSubmissionMutation.mutate(
        {
          id: parsedId,
          gradesDict: grades,
        },
        {
          onSuccess: () => {
            alert("Submission graded successfully!");
            navigate("/dashboard");
          },
          onError: (err: any) => {
            alert(err.response?.data?.detail || "An error occurred during manual grading.");
          },
        }
      );
    }
  };

  const totalMaxPoints = submission.assessment.questions.reduce(
    (acc: number, q: any) => acc + parseFloat(q.points),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 md:p-16">
      <div className="max-w-5xl mx-auto">

        {/* Back Link & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center text-sm font-semibold text-slate-400 hover:text-white transition mb-3"
            >
              ← Back to Submissions
            </button>
            <h1 className="text-3xl font-extrabold text-white">Manual Review Workspace</h1>
            <p className="text-slate-400 text-sm mt-1">
              Grading attempt of <span className="font-bold text-indigo-400">@{submission.student_username}</span> for <span className="font-semibold">{submission.assessment.title}</span>
            </p>
          </div>

          <div className="flex gap-3">
            <div className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl text-center">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500">Current Score</span>
              <span className="text-xl font-mono font-bold text-indigo-400">
                {submission.score} <span className="text-slate-500 text-sm">/ {totalMaxPoints.toFixed(2)}</span>
              </span>
            </div>
            <button
              onClick={handleGradeSubmit}
              disabled={gradeSubmissionMutation.isPending}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/10 transition flex items-center gap-2"
            >
              {gradeSubmissionMutation.isPending ? "Saving..." : "Publish Grades"}
            </button>
          </div>
        </div>

        {/* Anti-cheat and telemetry alerts card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-base font-bold text-slate-300 mb-1">Attempt Telemetry Summary</h3>
            <p className="text-slate-500 text-xs">Verified browser and connection attributes logged during start</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="text-sm">
                <span className="text-slate-500">IP Address:</span> <span className="font-mono text-slate-300 font-semibold">{submission.ip_address || "None"}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Browser info:</span> <span className="text-slate-400 truncate max-w-xs inline-block align-bottom">{submission.browser_info || "None"}</span>
              </div>
            </div>
          </div>

          <div className={`px-5 py-4 rounded-xl border flex items-center space-x-3 ${
            submission.tab_focus_losses > 3
              ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
              : "bg-slate-950 border-slate-850 text-slate-400"
          }`}>
            <div className="text-lg">⚠️</div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold">Window blurs logged</div>
              <div className="text-lg font-mono font-bold leading-none mt-1">{submission.tab_focus_losses} focus losses</div>
            </div>
          </div>
        </div>

        {/* Detailed Question Review Sheets */}
        <h2 className="text-xl font-bold text-white mb-6">Student Answer Sheets</h2>
        <div className="space-y-8">
          {submission.assessment.questions.map((aq: any, idx: number) => {
            const studentAns = submission.answers.find((a: any) => a.question === aq.question.id);
            const maxPointsNum = parseFloat(aq.points);
            const currentGrade = grades[aq.question.id] || { score: "0.00", is_correct: false, teacher_notes: "" };
            const errorMsg = validationErrors[aq.question.id];

            return (
              <div key={aq.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg grid grid-cols-1 lg:grid-cols-12">
                
                {/* Left side: Student answer */}
                <div className="lg:col-span-8 p-8 border-b lg:border-b-0 lg:border-r border-slate-850">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Question {(idx + 1).toString().padStart(2, "0")} ({aq.question.question_type.toUpperCase()})
                    </span>
                    <span className="text-sm font-semibold text-slate-400">
                      Max Points: {aq.points}
                    </span>
                  </div>

                  <div className="text-lg text-slate-200 mb-6 font-medium leading-relaxed">
                    {aq.question.text}
                  </div>

                  {/* Student response review */}
                  <div className="space-y-4">
                    {(aq.question.question_type === "single_choice" ||
                      aq.question.question_type === "multiple_choice") &&
                      aq.question.options.map((opt: any) => {
                        const wasSelected = studentAns?.selected_options?.includes(opt.id) || false;
                        const isCorrectKey = Array.isArray(aq.question.correct_answer)
                          ? aq.question.correct_answer.includes(opt.id)
                          : aq.question.correct_answer === opt.id;

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-4 rounded-xl border text-sm ${
                              wasSelected
                                ? "bg-slate-850 border-indigo-500/40 text-white"
                                : "bg-slate-900/40 border-slate-800 text-slate-500"
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center ${
                                aq.question.question_type === "single_choice" ? "rounded-full" : "rounded-md"
                              } ${wasSelected ? "bg-indigo-600 border-indigo-400" : "border-slate-700"}`}>
                                {wasSelected && <div className="h-1.5 w-1.5 bg-white rounded-full"></div>}
                              </div>
                              <span className="font-semibold">{opt.text}</span>
                            </div>

                            {/* Correct Key marker */}
                            {isCorrectKey && (
                              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Correct Option ✔️
                              </span>
                            )}
                          </div>
                        );
                      })}

                    {aq.question.question_type === "text" && (
                      <div className="space-y-4">
                        <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl shadow-inner">
                          <div className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-2">Student Response:</div>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-base">
                            {studentAns?.text_answer || <span className="italic text-slate-700">No response provided</span>}
                          </p>
                        </div>

                        {aq.question.correct_answer && (
                          <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl">
                            <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Correct Answer Target Key(s):</div>
                            <pre className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                              {typeof aq.question.correct_answer === "object"
                                ? JSON.stringify(aq.question.correct_answer, null, 2)
                                : String(aq.question.correct_answer)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {aq.question.question_type === "code" && (
                      <div className="space-y-4">
                        <div className="border border-slate-850 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-950 px-4 py-2 border-b border-slate-900 flex justify-between">
                            <span className="font-mono text-xs text-slate-600 uppercase tracking-widest font-bold">Student Code</span>
                          </div>
                          <pre className="p-4 bg-slate-950/80 font-mono text-sm text-cyan-300 overflow-x-auto leading-relaxed">
                            {studentAns?.text_answer || "// No response provided"}
                          </pre>
                        </div>

                        {aq.question.correct_answer && (
                          <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-xl overflow-hidden">
                            <div className="bg-emerald-950/25 px-4 py-2 border-b border-emerald-900/20">
                              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Solution Reference / Target Key</span>
                            </div>
                            <pre className="p-4 font-mono text-sm text-emerald-300 overflow-x-auto leading-relaxed">
                              {typeof aq.question.correct_answer === "object"
                                ? JSON.stringify(aq.question.correct_answer, null, 2)
                                : String(aq.question.correct_answer)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Grading controls */}
                <div className="lg:col-span-4 p-8 bg-slate-900/40 flex flex-col justify-between">
                  <div>
                    <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-4">Grading Review</h3>
                    
                    {/* Score Input */}
                    <div className="mb-4">
                      <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Awarded Score</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={currentGrade.score}
                          onChange={(e) => handleGradeChange(aq.question.id, "score", e.target.value, maxPointsNum)}
                          className={`w-full bg-slate-950 border px-4 py-2.5 rounded-lg font-mono text-base focus:outline-none ${
                            errorMsg ? "border-rose-500 text-rose-400" : "border-slate-850 text-slate-200 focus:border-indigo-500"
                          }`}
                        />
                        <span className="absolute right-4 top-3 text-sm text-slate-500">/ {aq.points}</span>
                      </div>
                      {errorMsg && <p className="text-rose-400 text-xs mt-1.5 font-semibold">{errorMsg}</p>}
                    </div>

                    {/* Correctness Toggle */}
                    <div className="flex items-center space-x-3 mb-6 bg-slate-950/50 p-3 rounded-lg border border-slate-850">
                      <input
                        type="checkbox"
                        id={`correct-${aq.id}`}
                        checked={currentGrade.is_correct}
                        onChange={(e) => handleGradeChange(aq.question.id, "is_correct", e.target.checked, maxPointsNum)}
                        className="h-4.5 w-4.5 bg-slate-900 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor={`correct-${aq.id}`} className="text-sm font-semibold text-slate-300 cursor-pointer">
                        Mark response as Correct
                      </label>
                    </div>

                    {/* Teacher evaluation notes */}
                    <div className="mb-4">
                      <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Teacher Evaluation Notes</label>
                      <textarea
                        value={currentGrade.teacher_notes}
                        onChange={(e) => handleGradeChange(aq.question.id, "teacher_notes", e.target.value, maxPointsNum)}
                        rows={4}
                        placeholder="Provide feedback to student..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-750 shadow-inner resize-none"
                      />
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
