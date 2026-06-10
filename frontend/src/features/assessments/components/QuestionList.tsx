import React, { useState } from "react";
import {
  useQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from "../hooks";
import type { Question, QuestionBank, QuestionOption, QuestionType } from "../types";

interface QuestionListProps {
  bank: QuestionBank;
  onBack: () => void;
}

export default function QuestionList({ bank, onBack }: QuestionListProps) {
  const { data: questions, isLoading, error } = useQuestions();
  const createQuestionMutation = useCreateQuestion();
  const updateQuestionMutation = useUpdateQuestion();
  const deleteQuestionMutation = useDeleteQuestion();

  // Modal and edit states
  const [isOpen, setIsOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form states
  const [text, setText] = useState("");
  const [qType, setQType] = useState<QuestionType>("single_choice");
  const [points, setPoints] = useState("1.00");
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [correctText, setCorrectText] = useState("");

  const bankQuestions = questions?.filter((q) => q.question_bank === bank.id) || [];

  const handleOpenModal = (q: Question | null = null) => {
    setEditingQuestion(q);
    if (q) {
      setText(q.text);
      setQType(q.question_type);
      setPoints(q.points);
      setOptions(q.options || []);
      
      // Load correct answers
      if (q.question_type === "single_choice" || q.question_type === "multiple_choice") {
        setCorrectAnswers(Array.isArray(q.correct_answer) ? (q.correct_answer as string[]) : [String(q.correct_answer)]);
        setCorrectText("");
      } else {
        setCorrectAnswers([]);
        setCorrectText(typeof q.correct_answer === "object" ? JSON.stringify(q.correct_answer) : String(q.correct_answer));
      }
    } else {
      setText("");
      setQType("single_choice");
      setPoints("1.00");
      setOptions([
        { id: "a", text: "Option A" },
        { id: "b", text: "Option B" },
      ]);
      setCorrectAnswers(["a"]);
      setCorrectText("");
    }
    setIsOpen(true);
  };

  const handleAddOption = () => {
    const nextId = String.fromCharCode(97 + options.length); // a, b, c, d...
    setOptions([...options, { id: nextId, text: `Option ${nextId.toUpperCase()}` }]);
  };

  const handleRemoveOption = (idx: number) => {
    const opt = options[idx];
    setOptions(options.filter((_, i) => i !== idx));
    setCorrectAnswers(correctAnswers.filter((id) => id !== opt.id));
  };

  const handleOptionTextChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = { ...updated[idx], text: val };
    setOptions(updated);
  };

  const toggleCorrectOption = (optId: string) => {
    if (qType === "single_choice") {
      setCorrectAnswers([optId]);
    } else {
      if (correctAnswers.includes(optId)) {
        setCorrectAnswers(correctAnswers.filter((id) => id !== optId));
      } else {
        setCorrectAnswers([...correctAnswers, optId]);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    let correct_payload: any = null;
    if (qType === "single_choice" || qType === "multiple_choice") {
      correct_payload = correctAnswers;
    } else {
      try {
        // Try parsing JSON if text answer is structure
        correct_payload = JSON.parse(correctText);
      } catch {
        correct_payload = correctText;
      }
    }

    const payload: Partial<Question> = {
      question_bank: bank.id,
      text,
      question_type: qType,
      points,
      options: qType === "single_choice" || qType === "multiple_choice" ? options : [],
      correct_answer: correct_payload,
    };

    if (editingQuestion) {
      updateQuestionMutation.mutate(
        {
          id: editingQuestion.id,
          data: payload,
        },
        {
          onSuccess: () => setIsOpen(false),
        }
      );
    } else {
      createQuestionMutation.mutate(payload, {
        onSuccess: () => setIsOpen(false),
      });
    }
  };

  const handleToggleArchive = (q: Question) => {
    const nextActive = !q.is_active;
    if (window.confirm(`Are you sure you want to ${nextActive ? "restore" : "archive"} this question?`)) {
      updateQuestionMutation.mutate({
        id: q.id,
        data: { is_active: nextActive },
      });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to permanently delete this question? This will fail if the question is archived or has history.")) {
      deleteQuestionMutation.mutate(id, {
        onError: (err: any) => {
          alert(err.response?.data?.detail || "Question has history or is archived and cannot be deleted physically.");
        },
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading questions...</div>;
  }

  if (error) {
    return <div className="text-rose-400 py-8 text-center">Failed to load questions.</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <button onClick={onBack} className="text-xs font-semibold text-slate-400 hover:text-white transition mb-1">
            ← Back to banks
          </button>
          <h2 className="text-xl font-bold text-white">{bank.title} — Questions</h2>
        </div>
        <button
          onClick={() => handleOpenModal(null)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition"
        >
          + Add Question
        </button>
      </div>

      <div className="space-y-4">
        {bankQuestions.length > 0 ? (
          bankQuestions.map((q, idx) => (
            <div
              key={q.id}
              className={`border p-6 rounded-xl transition ${
                q.is_active
                  ? "bg-slate-950/20 border-slate-850 hover:border-slate-750"
                  : "bg-slate-950/10 border-slate-900/60 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Question {(idx + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-800 border border-slate-750 text-indigo-400">
                    {q.question_type.replace("_", " ")}
                  </span>
                  {!q.is_active && (
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      Archived
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  Weight: <span className="font-semibold text-slate-200">{q.points} pts</span>
                </div>
              </div>

              <div className="text-slate-200 mb-5 leading-relaxed font-medium">
                {q.text}
              </div>

              {/* Display options if choices question */}
              {(q.question_type === "single_choice" || q.question_type === "multiple_choice") && q.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-5">
                  {q.options.map((opt) => {
                    const isCorrect = Array.isArray(q.correct_answer)
                      ? q.correct_answer.includes(opt.id)
                      : q.correct_answer === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-lg border text-sm ${
                          isCorrect
                            ? "bg-emerald-950/10 border-emerald-900/30 text-emerald-300"
                            : "bg-slate-900/30 border-slate-850 text-slate-400"
                        }`}
                      >
                        <span className="font-bold uppercase font-mono text-slate-500">{opt.id}.</span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex justify-end space-x-4 border-t border-slate-850 pt-3 text-xs font-bold">
                <button
                  onClick={() => handleToggleArchive(q)}
                  className="text-amber-500 hover:text-amber-400 transition"
                >
                  {q.is_active ? "Archive" : "Restore"}
                </button>
                <button
                  onClick={() => handleOpenModal(q)}
                  className="text-slate-400 hover:text-white transition"
                >
                  Edit Question
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-rose-500 hover:text-rose-400 transition"
                >
                  Delete Permanently
                </button>
              </div>

            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-550 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
            No questions found in this bank. Click Add Question to start.
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingQuestion ? "Edit Question" : "Add Question"}
            </h3>

            <div className="space-y-4 mb-6">
              {/* Question Text */}
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Question Text</label>
                <textarea
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. What is the value of x in 2x + 4 = 10?"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-750 shadow-inner resize-none"
                />
              </div>

              {/* Type and Points Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Question Type</label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as QuestionType)}
                    className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium text-sm"
                  >
                    <option value="single_choice">Single Choice</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="text">Text Response</option>
                    <option value="code">Code Response</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Default Points</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Choice Options Editor */}
              {(qType === "single_choice" || qType === "multiple_choice") && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider">Choice Options</label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                    >
                      + Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {options.map((opt, oIdx) => {
                      const isCorrect = correctAnswers.includes(opt.id);
                      return (
                        <div key={opt.id} className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => toggleCorrectOption(opt.id)}
                            className={`h-6 w-6 border rounded flex items-center justify-center text-xs font-bold uppercase transition ${
                              isCorrect
                                ? "bg-emerald-600 border-emerald-400 text-white"
                                : "bg-slate-950 border-slate-800 text-slate-500"
                            }`}
                          >
                            {opt.id}
                          </button>
                          <input
                            type="text"
                            required
                            value={opt.text}
                            onChange={(e) => handleOptionTextChange(oIdx, e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-850 px-3 py-1.5 rounded text-sm text-slate-200 focus:outline-none"
                          />
                          {options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(oIdx)}
                              className="text-rose-500 hover:text-rose-400 text-sm font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Text/Code target key response */}
              {(qType === "text" || qType === "code") && (
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                    Solution Key / Target Answers (JSON or Text)
                  </label>
                  <input
                    type="text"
                    value={correctText}
                    onChange={(e) => setCorrectText(e.target.value)}
                    placeholder="e.g. 42 or ['yes', 'yeah']"
                    className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                  <p className="text-slate-500 text-[10px] mt-1">
                    Optionally pass a string, list, or JSON dictionary representing correct targets.
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2.5 border border-slate-800 rounded-lg text-slate-400 font-bold hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition"
              >
                Save Question
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
