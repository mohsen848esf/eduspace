import { useParams, useNavigate } from "react-router-dom";
import { useSubmission } from "../hooks";

export default function AssessmentResultsPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const parsedId = Number(submissionId);

  const { data: submission, isLoading, error } = useSubmission(parsedId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md text-center p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
          <p className="text-rose-400 font-bold mb-2">Error Loading Results</p>
          <p className="text-slate-400 mb-6">Could not load assessment score sheet.</p>
          <button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isGraded = submission.status === "graded";
  const scoreNum = parseFloat(submission.score);
  const passingScoreNum = parseFloat(submission.assessment.passing_score);
  const isPassed = scoreNum >= passingScoreNum;

  // Sum total max points of all questions
  const totalMaxPoints = submission.assessment.questions.reduce(
    (acc: number, q: any) => acc + parseFloat(q.points),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Link */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-8 flex items-center text-sm font-semibold text-slate-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </button>

        {/* Results Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Exam Assessment Result</span>
            <h1 className="text-3xl font-extrabold text-white mt-1 mb-2">{submission.assessment.title}</h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xl">{submission.assessment.description}</p>
          </div>

          <div className="text-center bg-slate-950 px-8 py-6 rounded-2xl border border-slate-850 shadow-inner flex flex-col items-center justify-center min-w-[200px]">
            {isGraded ? (
              <>
                <div className={`text-4xl font-extrabold mb-2 ${isPassed ? "text-emerald-400" : "text-rose-400"}`}>
                  {submission.score} <span className="text-slate-500 text-base font-normal">/ {totalMaxPoints.toFixed(2)}</span>
                </div>
                <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPassed ? "bg-emerald-500/10 border border-emerald-500 text-emerald-400" : "bg-rose-500/10 border border-rose-500 text-rose-400"
                }`}>
                  {isPassed ? "Passed 🎉" : "Failed ❌"}
                </span>
              </>
            ) : (
              <>
                <div className="text-amber-400 font-bold text-lg mb-2">Pending Review ⏳</div>
                <span className="text-xs text-slate-500 max-w-[150px] leading-normal">Your choices are saved. A teacher will grade code/text questions shortly.</span>
              </>
            )}
          </div>
        </div>

        {/* Attempt Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Time Started</div>
            <div className="font-semibold text-slate-200">{new Date(submission.started_at).toLocaleTimeString()}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Time Submitted</div>
            <div className="font-semibold text-slate-200">
              {submission.submitted_at ? new Date(submission.submitted_at).toLocaleTimeString() : "N/A"}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Passing Mark</div>
            <div className="font-semibold text-slate-200">{submission.assessment.passing_score} pts</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tab switches logged</div>
            <div className={`font-semibold ${submission.tab_focus_losses > 3 ? "text-rose-400 font-bold" : "text-slate-200"}`}>
              {submission.tab_focus_losses}
            </div>
          </div>
        </div>

        {/* Question-by-Question Breakdown */}
        <h2 className="text-xl font-bold text-white mb-6">Detailed Sheet Review</h2>
        <div className="space-y-6">
          {submission.assessment.questions.map((aq: any, idx: number) => {
            const studentAns = submission.answers.find((a: any) => a.question === aq.question.id);
            const scoreVal = studentAns ? parseFloat(studentAns.score) : 0;
            const maxVal = parseFloat(aq.points);
            const isCorrect = studentAns ? studentAns.is_correct : false;

            return (
              <div key={aq.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Question {(idx + 1).toString().padStart(2, "0")}
                  </span>
                  
                  {isGraded ? (
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        isCorrect ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        Score: {scoreVal.toFixed(2)} / {maxVal.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-bold uppercase tracking-wider">
                      Auto-Graded: {scoreVal.toFixed(2)} / {maxVal.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="text-lg text-slate-200 mb-6 font-medium leading-relaxed">
                  {aq.question.text}
                </div>

                {/* Render Student Selection details */}
                <div className="space-y-3">
                  {(aq.question.question_type === "single_choice" ||
                    aq.question.question_type === "multiple_choice") &&
                    aq.question.options.map((opt: any) => {
                      const wasSelected = studentAns?.selected_options?.includes(opt.id) || false;
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center space-x-3 p-4 rounded-lg border text-base ${
                            wasSelected
                              ? "bg-slate-850 border-indigo-500/50 text-white"
                              : "bg-slate-900/50 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div
                            className={`h-4.5 w-4.5 rounded border flex items-center justify-center ${
                              aq.question.question_type === "single_choice" ? "rounded-full" : "rounded-md"
                            } ${wasSelected ? "bg-indigo-600 border-indigo-400" : "border-slate-700"}`}
                          >
                            {wasSelected && <div className="h-1.5 w-1.5 bg-white rounded-full"></div>}
                          </div>
                          <span className="font-medium">{opt.text}</span>
                        </div>
                      );
                    })}

                  {aq.question.question_type === "text" && (
                    <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl">
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Your Answer:</div>
                      <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {studentAns?.text_answer || <span className="italic text-slate-600">No response provided</span>}
                      </div>
                    </div>
                  )}

                  {aq.question.question_type === "code" && (
                    <div className="border border-slate-850 rounded-xl overflow-hidden shadow">
                      <div className="bg-slate-950 px-4 py-2 border-b border-slate-900">
                        <span className="font-mono text-xs text-slate-600 uppercase tracking-widest font-bold">Your Code Solution</span>
                      </div>
                      <pre className="p-4 bg-slate-950/80 font-mono text-sm text-cyan-300 overflow-x-auto leading-relaxed">
                        {studentAns?.text_answer || "// No response provided"}
                      </pre>
                    </div>
                  )}

                  {/* Teacher Feedback Notes */}
                  {studentAns?.teacher_notes && (
                    <div className="mt-4 p-4 bg-indigo-950/20 border border-indigo-900/50 rounded-xl">
                      <div className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1.5">Teacher Feedback:</div>
                      <p className="text-slate-300 leading-relaxed text-sm italic">{studentAns.teacher_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
