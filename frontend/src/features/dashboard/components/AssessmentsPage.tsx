import { useState } from "react";
import QuestionBankList from "../../assessments/components/QuestionBankList";
import QuestionList from "../../assessments/components/QuestionList";
import AssessmentList from "../../assessments/components/AssessmentList";
import type { QuestionBank } from "../../assessments/types";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

export default function AssessmentsPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";

  const [activeSubTab, setActiveSubTab] = useState<"assessments" | "banks">("assessments");
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);

  return (
    <AppShell title={isFarsi ? "ارزیابی‌ها و آزمون‌ها" : "Assessments"}>
      <div className="flex flex-col gap-4">
        {/* Sub-tabs navigation */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 scrollbar-none bg-[var(--s1)] p-2 rounded-t-xl border border-b-0 border-[var(--b)]">
          <button
            onClick={() => setActiveSubTab("assessments")}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeSubTab === "assessments"
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "آزمون‌ها" : "Exams / Assessments"}
          </button>
          <button
            onClick={() => {
              setActiveSubTab("banks");
              setSelectedBank(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer transition-colors duration-150 whitespace-nowrap bg-transparent ${
              activeSubTab === "banks"
                ? "border-[var(--brand)] text-[var(--brand-text)]"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)]"
            }`}
          >
            {isFarsi ? "بانک سوالات" : "Question Banks"}
          </button>
        </div>

        {/* Content Area */}
        <div className="rounded-b-xl overflow-hidden">
          {activeSubTab === "assessments" && (
            <AssessmentList />
          )}

          {activeSubTab === "banks" && (
            selectedBank ? (
              <QuestionList bank={selectedBank} onBack={() => setSelectedBank(null)} />
            ) : (
              <QuestionBankList onSelectBank={(bank) => setSelectedBank(bank)} />
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}
