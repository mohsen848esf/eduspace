import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Button from "../../../components/ui/Button";
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

  // Bulk / multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isBulkPublishOpen, setIsBulkPublishOpen] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedTokens([]);
      }
      return !prev;
    });
  };

  const handleSelect = (token: string, isSelected: boolean) => {
    setSelectedTokens((prev) =>
      isSelected ? [...prev, token] : prev.filter((t) => t !== token)
    );
  };

  const ownerItems = items.filter((rec) => rec.is_owner);
  const handleSelectAll = () => {
    if (selectedTokens.length === ownerItems.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens(ownerItems.map((rec) => rec.public_token));
    }
  };

  const handleBulkUnpublish = async () => {
    setIsBulkActionLoading(true);
    try {
      await Promise.all(selectedTokens.map((tok) => recordingsApi.unpublish(tok)));
      toast.success(t("editor.unpublished"));
      setSelectedTokens([]);
      setSelectionMode(false);
      refresh();
    } catch {
      toast.error(t("editor.publishError"));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkPublish = async ({
    userIds,
    isLinkShared,
  }: {
    userIds: number[];
    isLinkShared: boolean;
  }) => {
    setIsBulkActionLoading(true);
    try {
      await Promise.all(
        selectedTokens.map((tok) =>
          recordingsApi.publish(tok, userIds, { isLinkShared })
        )
      );
      toast.success(t("editor.published"));
      setSelectedTokens([]);
      setSelectionMode(false);
      refresh();
    } catch {
      toast.error(t("editor.publishError"));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const confirmBulkDelete = async () => {
    setIsBulkActionLoading(true);
    setShowBulkDeleteConfirm(false);
    try {
      await Promise.all(selectedTokens.map((tok) => recordingsApi.remove(tok)));
      toast.success(t("editor.saved"));
      setSelectedTokens([]);
      setSelectionMode(false);
      refresh();
    } catch {
      toast.error(t("editor.saveError"));
    } finally {
      setIsBulkActionLoading(false);
    }
  };

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
                  "px-3 min-h-9 h-9 rounded-lg border cursor-pointer text-xs font-bold transition-colors flex-shrink-0",
                  filter === f
                    ? "bg-[var(--brand-soft)] text-[var(--brand)] border-[var(--brand)]"
                    : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
                )}
              >
                {t(`filters.${f}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
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

            {ownerItems.length > 0 && (
              <button
                onClick={toggleSelectionMode}
                className={cn(
                  "px-3 h-9 rounded-lg border cursor-pointer text-xs font-bold transition-colors flex-shrink-0 flex items-center justify-center gap-1.5",
                  selectionMode
                    ? "bg-[var(--brand-soft)] text-[var(--brand)] border-[var(--brand)]"
                    : "bg-[var(--s2)] text-[var(--t2)] border-[var(--b)] hover:bg-[var(--s3)]"
                )}
              >
                <span>✏️</span>
                <span>
                  {selectionMode ? t("publishModal.cancel") : t("card.edit")}
                </span>
              </button>
            )}

            {selectionMode && (
              <button
                onClick={handleSelectAll}
                className="px-3 h-9 rounded-lg border border-[var(--b)] bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] cursor-pointer text-xs font-semibold transition-colors flex-shrink-0"
              >
                {selectedTokens.length === ownerItems.length
                  ? t("publishModal.clearAll")
                  : t("publishModal.selectAll")}
              </button>
            )}
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
                selected={selectedTokens.includes(rec.public_token)}
                onSelect={handleSelect}
                selectionMode={selectionMode}
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

      {/* Bulk Action Bar */}
      {selectedTokens.length > 0 && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 bg-[var(--s1)] border border-[var(--brand)]/30 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 animate-slide-up max-w-[95vw] w-full sm:w-auto sm:min-w-[450px]">
          <div className="text-center sm:text-start flex-1">
            <div className="text-xs font-bold text-[var(--t1)]">
              {t("publishModal.selectedCount", { count: selectedTokens.length })}
            </div>
            <div className="text-[10px] text-[var(--t3)] hidden sm:block">
              Apply bulk actions to selected recordings
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkUnpublish}
              loading={isBulkActionLoading}
              className="flex-1 sm:flex-initial"
            >
              {t("editor.unpublish")}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsBulkPublishOpen(true)}
              loading={isBulkActionLoading}
              className="flex-1 sm:flex-initial"
            >
              {t("editor.publish")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
              loading={isBulkActionLoading}
              className="flex-1 sm:flex-initial"
            >
              {t("card.delete")}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <ConfirmModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={t("card.deleteTitle")}
        description={t("card.deleteConfirm")}
        confirmLabel={t("card.delete")}
        confirmVariant="danger"
        isLoading={isBulkActionLoading}
        blocking
        onConfirm={confirmBulkDelete}
      />

      {/* Bulk Publish Modal */}
      <PublishModal
        open={isBulkPublishOpen}
        onClose={() => setIsBulkPublishOpen(false)}
        onPublish={handleBulkPublish}
      />
    </AppShell>
  );
}
