import { useState } from "react";
import { reportsApi } from "../api/reports.api";
import { Download, Award, Receipt, CalendarRange } from "lucide-react";
import toast from "react-hot-toast";

export default function ReportsExportWidget() {
  const [activeExport, setActiveExport] = useState<string | null>(null);

  const handleExport = async (type: "grades" | "financials" | "attendance") => {
    try {
      setActiveExport(type);
      toast.loading(`Compiling and downloading ${type} report...`, { id: `export-${type}` });
      await reportsApi.exportReport(type);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded successfully!`, { id: `export-${type}` });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || `Failed to download ${type} report. Check permissions.`, { id: `export-${type}` });
    } finally {
      setActiveExport(null);
    }
  };

  const reportCards = [
    {
      id: "grades" as const,
      title: "Academic Grades Report",
      description: "Includes student names, usernames, exam submissions, grades, time completed, and focus loss telemetry counts.",
      icon: <Award className="w-6 h-6 text-indigo-400" />,
      colorClass: "hover:border-indigo-500/25",
    },
    {
      id: "attendance" as const,
      title: "Student Attendance Logs",
      description: "Tabular summary logs of academic classes, session names, attendance statuses (present/absent/late), joining timestamps, and teacher notes.",
      icon: <CalendarRange className="w-6 h-6 text-emerald-400" />,
      colorClass: "hover:border-emerald-500/25",
    },
    {
      id: "financials" as const,
      title: "Financial Statements Ledger",
      description: "Generates cash flow lists combining student tuition invoices, settlement statuses, and approved organizational expense items.",
      icon: <Receipt className="w-6 h-6 text-amber-400" />,
      colorClass: "hover:border-amber-500/25",
    },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[var(--t1)]">CSV Report Exports</h3>
          <p className="text-xs text-[var(--t2)]">Download comprehensive organization reports for audits, grading, and financials.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map((card) => {
          const isLoading = activeExport === card.id;
          return (
            <div
              key={card.id}
              className={`p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] ${card.colorClass} hover:shadow-lg transition-all duration-300 flex flex-col justify-between`}
            >
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[var(--s2)] w-fit">
                  {card.icon}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-[var(--t1)] text-md">{card.title}</h4>
                  <p className="text-[var(--t2)] text-xs leading-relaxed">{card.description}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--b)]/50">
                <button
                  onClick={() => handleExport(card.id)}
                  disabled={activeExport !== null}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] shadow-md shadow-indigo-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
