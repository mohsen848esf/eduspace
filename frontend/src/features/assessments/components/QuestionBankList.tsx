import React, { useState } from "react";
import {
  useQuestionBanks,
  useCreateQuestionBank,
  useUpdateQuestionBank,
  useDeleteQuestionBank,
} from "../hooks";
import type { QuestionBank } from "../types";

interface QuestionBankListProps {
  onSelectBank: (bank: QuestionBank) => void;
}

export default function QuestionBankList({ onSelectBank }: QuestionBankListProps) {
  const { data: banks, isLoading, error } = useQuestionBanks();
  const createBankMutation = useCreateQuestionBank();
  const updateBankMutation = useUpdateQuestionBank();
  const deleteBankMutation = useDeleteQuestionBank();

  const [isOpen, setIsOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleOpenModal = (bank: QuestionBank | null = null) => {
    setEditingBank(bank);
    if (bank) {
      setTitle(bank.title);
      setDescription(bank.description);
    } else {
      setTitle("");
      setDescription("");
    }
    setIsOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingBank) {
      updateBankMutation.mutate(
        {
          id: editingBank.id,
          data: { title, description },
        },
        {
          onSuccess: () => {
            setIsOpen(false);
            setEditingBank(null);
          },
        }
      );
    } else {
      createBankMutation.mutate(
        { title, description },
        {
          onSuccess: () => {
            setIsOpen(false);
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this question bank? All questions in it will be cascading-deleted.")) {
      deleteBankMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading banks...</div>;
  }

  if (error) {
    return <div className="text-rose-400 py-8 text-center">Failed to load question banks.</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Question Banks</h2>
          <p className="text-slate-500 text-xs mt-0.5">Manage question pools and items across assessments</p>
        </div>
        <button
          onClick={() => handleOpenModal(null)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition"
        >
          + Create Bank
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banks && banks.length > 0 ? (
          banks.map((bank) => (
            <div
              key={bank.id}
              className="bg-slate-950/40 border border-slate-850 hover:border-slate-750 p-5 rounded-xl transition flex flex-col justify-between"
            >
              <div>
                <h3 className="font-bold text-white text-lg mb-1.5">{bank.title}</h3>
                <p className="text-slate-400 text-sm leading-normal mb-4 min-h-[40px]">
                  {bank.description || <span className="italic text-slate-650">No description provided</span>}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4 mt-2">
                <button
                  onClick={() => onSelectBank(bank)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  View Questions →
                </button>
                <div className="flex space-x-3 text-xs">
                  <button
                    onClick={() => handleOpenModal(bank)}
                    className="font-bold text-slate-400 hover:text-white transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(bank.id)}
                    className="font-bold text-rose-500 hover:text-rose-400 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-12 text-slate-550 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
            No question banks found. Click Create Bank to start.
          </div>
        )}
      </div>

      {/* Save Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingBank ? "Edit Question Bank" : "Create Question Bank"}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Calculus Midterm Bank"
                  className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium text-sm"
                />
              </div>
              
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide context or summary for this bank..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200 placeholder-slate-750 shadow-inner resize-none"
                />
              </div>
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
                disabled={createBankMutation.isPending || updateBankMutation.isPending}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition"
              >
                Save Bank
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
