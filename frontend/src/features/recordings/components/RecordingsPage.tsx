import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import RecordingCard from "./RecordingCard";
import recordingsApi from "../api/recordings.api";
import { useRecordings, type RecordingsFilter } from "../hooks/useRecordings";
import { cn } from "../../../lib/utils";

const FILTERS: RecordingsFilter[] = [
  "all",
  "published",
  "drafts",
  "processing",
  "failed",
];

export default function RecordingsPage() {
  const { t } = useTranslation("recordings");
  const [activeNav, setActiveNav] = useState("recordings");
  const { items, isLoading, filter, setFilter, refresh } = useRecordings("all");

  const handleDelete = async (token: string) => {
    try {
      await recordingsApi.remove(token);
      refresh();
    } catch {
      toast.error(t("editor.saveError"));
    }
  };

  return (
    <AppShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      <div className="flex flex-col gap-4 fade-in">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 h-8 rounded-lg border-none cursor-pointer text-xs font-semibold transition-colors",
                filter === f
                  ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
              )}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <span className="text-4xl">📭</span>
            <p className="text-sm font-semibold text-[var(--t1)]">
              {t("page.empty")}
            </p>
            <p className="text-xs text-[var(--t3)] max-w-xs">
              {t("page.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((rec) => (
              <RecordingCard
                key={rec.public_token}
                recording={rec}
                onDelete={rec.is_owner ? handleDelete : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
