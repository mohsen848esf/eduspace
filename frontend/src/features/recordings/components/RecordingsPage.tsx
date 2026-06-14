import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import RecordingCard from "./RecordingCard";
import PublishModal from "./PublishModal";
import recordingsApi, { type Recording } from "../api/recordings.api";
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
  const { items, isLoading, filter, setFilter, searchQuery, setSearchQuery, refresh } = useRecordings("all");

  const [shareTarget, setShareTarget] = useState<Recording | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recording | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await recordingsApi.remove(deleteTarget.public_token);
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error(t("editor.saveError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async ({
    userIds,
    isLinkShared,
  }: {
    userIds: number[];
    isLinkShared: boolean;
  }) => {
    if (!shareTarget) return;
    try {
      await recordingsApi.publish(shareTarget.public_token, userIds, {
        isLinkShared,
      });
      toast.success(t("editor.published"));
      refresh();
    } catch {
      toast.error(t("editor.publishError"));
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
        {/* Filters and Search row */}
        <div className="md:static sticky top-0 z-10 bg-[var(--s0)] -mx-4 px-4 pt-1 pb-2 md:m-0 md:p-0 md:bg-transparent flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 min-h-9 h-9 rounded-lg border-none cursor-pointer text-xs font-semibold transition-colors flex-shrink-0",
                  filter === f
                    ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                    : "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
                )}
              >
                {t(`filters.${f}`)}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--t3)] text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("publishModal.searchPlaceholder") || "Search recordings..."}
              className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-lg ps-8 pe-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] outline-none focus:border-[var(--brand)] transition-colors h-9"
            />
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {items.map((rec) => (
              <RecordingCard
                key={rec.public_token}
                recording={rec}
                onShare={rec.is_owner ? setShareTarget : undefined}
                onDelete={rec.is_owner ? setDeleteTarget : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareTarget && (
        <PublishModal
          open={!!shareTarget}
          recordingToken={shareTarget.public_token}
          roomCode={shareTarget.room_code}
          initialSelected={
            shareTarget.shared_with?.map((s) => ({
              id: s.id,
              username: s.username,
              full_name: s.full_name,
            })) ?? []
          }
          initialLinkShared={shareTarget.is_link_shared ?? false}
          onClose={() => setShareTarget(null)}
          onPublish={handleShare}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={t("card.deleteTitle")}
        description={t("card.deleteConfirm")}
        confirmLabel={t("card.delete")}
        confirmVariant="danger"
        isLoading={isDeleting}
        blocking
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
