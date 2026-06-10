import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSubmission,
  useUpdateAnswer,
  useSubmitSubmission,
  useRecordTabLoss,
  useUpdateTelemetry,
} from "../hooks";

export default function TakeAssessmentPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const parsedId = Number(submissionId);

  const { data: submission, isLoading, error } = useSubmission(parsedId);
  const updateAnswerMutation = useUpdateAnswer();
  const submitSubmissionMutation = useSubmitSubmission();
  const recordTabLossMutation = useRecordTabLoss();
  const updateTelemetryMutation = useUpdateTelemetry();

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  const localAnswersRef = useRef<Record<number, { selected_options: string[] | null; text_answer: string | null }>>({});
  const debounceTimersRef = useRef<Record<number, any>>({});
  const hasLoggedTelemetry = useRef(false);

  // 1. Telemetry Log on mount
  useEffect(() => {
    if (submission && !hasLoggedTelemetry.current) {
      hasLoggedTelemetry.current = true;
      updateTelemetryMutation.mutate({
        id: parsedId,
        data: {
          browser_info: navigator.userAgent,
        },
      });
    }
  }, [submission, parsedId]);

  // 2. Anti-cheat: Tab focus loss tracking
  useEffect(() => {
    if (!submission || submission.status !== "started") return;

    const handleFocusLoss = () => {
      // Record tab loss
      recordTabLossMutation.mutate(parsedId, {
        onSuccess: (data) => {
          setWarningMessage(
            `Warning: You moved away from the exam window! This focus loss has been logged. Total logs: ${data.tab_focus_losses}`
          );
          setShowWarningModal(true);
        },
      });
    };

    window.addEventListener("blur", handleFocusLoss);
    
    // Also track visibilitychange
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleFocusLoss();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleFocusLoss);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [submission, parsedId]);

  // 3. Timer implementation
  useEffect(() => {
    if (!submission || submission.status !== "started") return;

    const startedTime = new Date(submission.started_at).getTime();
    const durationMs = submission.assessment.duration_minutes * 60 * 1000;
    const endTime = startedTime + durationMs;

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = Math.floor((endTime - now) / 1000);
      
      if (difference <= 0) {
        setTimeLeft(0);
        // Auto-submit when time is up
        handleAutoSubmit();
      } else {
        setTimeLeft(difference);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [submission]);

  // Handle auto submit on time out
  const handleAutoSubmit = () => {
    submitSubmissionMutation.mutate(parsedId, {
      onSuccess: () => {
        navigate(`/assessments/results/${parsedId}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your assessment attempt...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md text-center p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
          <p className="text-rose-400 font-bold mb-2">Error Loading Assessment</p>
          <p className="text-slate-400 mb-6">Either this exam session does not exist, or you lack permission to access it.</p>
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (submission.status !== "started") {
    // Already submitted/graded
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md text-center p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
          <p className="text-indigo-400 font-bold mb-2">Exam Already Finalized</p>
          <p className="text-slate-400 mb-6">This attempt was submitted or graded on {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "earlier"}.</p>
          <button onClick={() => navigate(`/assessments/results/${parsedId}`)} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500">
            View Results
          </button>
        </div>
      </div>
    );
  }

  const currentAq = submission.assessment.questions[activeQuestionIndex];
  const currentAnswer = submission.answers.find((ans: any) => ans.question === currentAq.question.id);

  // Initialize local answer state for this question if empty
  if (currentAnswer && !localAnswersRef.current[currentAnswer.id]) {
    localAnswersRef.current[currentAnswer.id] = {
      selected_options: currentAnswer.selected_options,
      text_answer: currentAnswer.text_answer,
    };
  }

  const localState = currentAnswer ? localAnswersRef.current[currentAnswer.id] : { selected_options: null, text_answer: "" };

  const triggerAutosave = (answerId: number, selected: string[] | null, text: string | null) => {
    setAutosaveStatus("saving");
    
    if (debounceTimersRef.current[answerId]) {
      clearTimeout(debounceTimersRef.current[answerId]);
    }

    debounceTimersRef.current[answerId] = setTimeout(() => {
      updateAnswerMutation.mutate(
        {
          id: answerId,
          data: {
            selected_options: selected,
            text_answer: text,
          },
        },
        {
          onSuccess: () => setAutosaveStatus("saved"),
          onError: () => setAutosaveStatus("error"),
        }
      );
    }, 1200); // 1.2s debounce window
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentAnswer) return;

    let newSelected: string[] = [];
    if (currentAq.question.question_type === "single_choice") {
      newSelected = [optionId];
    } else {
      // multiple choice
      const existing = localState.selected_options || [];
      if (existing.includes(optionId)) {
        newSelected = existing.filter(x => x !== optionId);
      } else {
        newSelected = [...existing, optionId];
      }
    }

    localAnswersRef.current[currentAnswer.id] = {
      ...localState,
      selected_options: newSelected,
    };

    // Trigger state force refresh and queue save
    setActiveQuestionIndex(activeQuestionIndex);
    triggerAutosave(currentAnswer.id, newSelected, localState.text_answer);
  };

  const handleTextAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentAnswer) return;

    const val = e.target.value;
    localAnswersRef.current[currentAnswer.id] = {
      ...localState,
      text_answer: val,
    };

    setActiveQuestionIndex(activeQuestionIndex);
    triggerAutosave(currentAnswer.id, localState.selected_options, val);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmitClick = () => {
    if (window.confirm("Are you sure you want to submit your assessment? Once submitted, answers are permanently locked.")) {
      submitSubmissionMutation.mutate(parsedId, {
        onSuccess: () => {
          navigate(`/assessments/results/${parsedId}`);
        },
      });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4 shadow">
        <div className="flex items-center space-x-4">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            EduSpace Assessment
          </span>
          <span className="text-slate-500">|</span>
          <span className="font-semibold text-slate-300">{submission.assessment.title}</span>
        </div>

        <div className="flex items-center space-x-6">
          {/* Autosave badge */}
          <div className="flex items-center space-x-1.5 text-sm text-slate-400">
            {autosaveStatus === "saved" && <span className="text-emerald-400">● Draft Saved 💾</span>}
            {autosaveStatus === "saving" && <span className="text-amber-400 animate-pulse">● Saving... 🔄</span>}
            {autosaveStatus === "error" && <span className="text-rose-400">● Save Failed ⚠️</span>}
          </div>

          {/* Timer Widget */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-4 py-1.5 shadow-inner">
            <span className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Time Remaining:</span>
            <span className={`font-mono text-lg font-bold tracking-wider ${timeLeft !== null && timeLeft < 300 ? "text-rose-500 animate-pulse" : "text-cyan-400"}`}>
              {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Question Sidebar Panel */}
        <aside className="w-80 border-r border-slate-900 bg-slate-900/50 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-4">Question Panel</h3>
            <div className="grid grid-cols-4 gap-3">
              {submission.assessment.questions.map((aq: any, idx: number) => {
                const ans = submission.answers.find((a: any) => a.question === aq.question.id);
                const isAnswered = ans && (ans.selected_options?.length || ans.text_answer?.trim());
                const isActive = idx === activeQuestionIndex;

                return (
                  <button
                    key={aq.id}
                    onClick={() => setActiveQuestionIndex(idx)}
                    className={`h-11 rounded-lg border font-mono font-bold transition flex items-center justify-center ${
                      isActive
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-500/20"
                        : isAnswered
                        ? "bg-slate-800 border-indigo-900 text-indigo-300"
                        : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700"
                    }`}
                  >
                    {(idx + 1).toString().padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <button
              onClick={handleSubmitClick}
              disabled={submitSubmissionMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-lg text-white font-bold tracking-wide shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:from-indigo-600 hover:to-cyan-600 transition"
            >
              Submit Assessment
            </button>
          </div>
        </aside>

        {/* Question Content Sheet */}
        <main className="flex-1 overflow-y-auto p-12 bg-slate-950/20 flex flex-col justify-between">
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-indigo-400">
                Question {activeQuestionIndex + 1} of {submission.assessment.questions.length}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                Points: {currentAq.points}
              </span>
            </div>

            <div className="mb-10 text-xl leading-relaxed text-slate-200 font-medium">
              {currentAq.question.text}
            </div>

            {/* Answer Options renders */}
            <div className="space-y-4">
              {(currentAq.question.question_type === "single_choice" ||
                currentAq.question.question_type === "multiple_choice") &&
                currentAq.question.options.map((opt: any) => {
                  const isChecked = localState.selected_options?.includes(opt.id) || false;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`flex items-center space-x-4 border rounded-xl p-5 cursor-pointer transition ${
                        isChecked
                          ? "bg-indigo-950/30 border-indigo-500/80 text-white shadow-sm shadow-indigo-500/5"
                          : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-900/60 hover:border-slate-700"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded flex items-center justify-center border transition-all ${
                          currentAq.question.question_type === "single_choice" ? "rounded-full" : "rounded-md"
                        } ${isChecked ? "bg-indigo-600 border-indigo-400" : "border-slate-600"}`}
                      >
                        {isChecked && <div className="h-2 w-2 bg-white rounded-full"></div>}
                      </div>
                      <span className="font-medium text-lg">{opt.text}</span>
                    </div>
                  );
                })}

              {currentAq.question.question_type === "text" && (
                <textarea
                  value={localState.text_answer || ""}
                  onChange={handleTextAnswerChange}
                  rows={8}
                  placeholder="Type your response here..."
                  className="w-full bg-slate-900/40 border border-slate-800 rounded-xl p-5 font-sans text-lg focus:outline-none focus:border-indigo-500/80 text-slate-200 placeholder-slate-600 shadow-inner"
                />
              )}

              {currentAq.question.question_type === "code" && (
                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-slate-900 px-5 py-3 border-b border-slate-850 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500 uppercase tracking-widest font-bold">Code Workspace</span>
                  </div>
                  <textarea
                    value={localState.text_answer || ""}
                    onChange={handleTextAnswerChange}
                    rows={12}
                    placeholder="// Write your code solution here..."
                    className="w-full bg-slate-950 font-mono text-base p-5 focus:outline-none text-cyan-300 placeholder-slate-700 leading-relaxed shadow-inner"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Next/Prev Navigation controls */}
          <div className="max-w-4xl mx-auto w-full flex justify-between mt-12 pt-6 border-t border-slate-900">
            <button
              disabled={activeQuestionIndex === 0}
              onClick={() => setActiveQuestionIndex(activeQuestionIndex - 1)}
              className="px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 font-bold hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              ← Previous Question
            </button>
            
            <button
              disabled={activeQuestionIndex === submission.assessment.questions.length - 1}
              onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
              className="px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 font-bold hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              Next Question →
            </button>
          </div>
        </main>
      </div>

      {/* Focus Loss Warning Modal overlay */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="h-12 w-12 bg-rose-500/10 border border-rose-500 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-3">Anti-Cheat Alert</h3>
            <p className="text-slate-400 text-center text-base mb-6 leading-relaxed">
              {warningMessage}
            </p>
            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition"
            >
              Return to Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
