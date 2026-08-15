import React from "react";
import { useTranslation } from "react-i18next";
import {
  MailCheck,
  Mail,
  Trash2,
  RotateCw,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import Button from "@/components/ui/Button";

export interface InboxToolbarProps {
  selectedCount: number;
  totalVisibleCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onMarkReadBatch: () => void;
  onMarkUnreadBatch: () => void;
  onDeleteBatch: () => void;
  onMarkAllRead: () => void;
  onRefresh: () => void;
  isHydrating: boolean;
}

export const InboxToolbar: React.FC<InboxToolbarProps> = ({
  selectedCount,
  totalVisibleCount,
  searchQuery,
  onSearchChange,
  onSelectAll,
  onSelectNone,
  onMarkReadBatch,
  onMarkUnreadBatch,
  onDeleteBatch,
  onMarkAllRead,
  onRefresh,
  isHydrating,
}) => {
  const { t } = useTranslation(["notifications", "common"]);

  const isAllSelected = totalVisibleCount > 0 && selectedCount === totalVisibleCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalVisibleCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--s1)] border-b border-[var(--b)] text-sm">
      {/* Left: Master Checkbox & Batch Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={isAllSelected || isPartiallySelected ? onSelectNone : onSelectAll}
          className="p-1.5 rounded-lg hover:bg-[var(--s2)] text-[var(--t2)] hover:text-[var(--t1)] transition-colors cursor-pointer"
          title={isAllSelected ? "Deselect all" : "Select all"}
        >
          {isAllSelected ? (
            <CheckSquare className="w-5 h-5 text-[var(--brand)]" />
          ) : isPartiallySelected ? (
            <MinusSquare className="w-5 h-5 text-[var(--brand)]" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>

        {selectedCount > 0 ? (
          <div className="flex items-center gap-1.5 animate-in fade-in">
            <span className="text-xs font-semibold text-[var(--t2)] px-2">
              {t("notifications:inbox.selectedCount", { count: selectedCount, defaultValue: `${selectedCount} selected` })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkReadBatch}
              title={t("notifications:inbox.markRead", { defaultValue: "Mark as Read" })}
              className="h-8 px-2.5"
            >
              <MailCheck className="w-4 h-4 me-1.5 text-[var(--brand)]" />
              <span>{t("notifications:inbox.markRead", { defaultValue: "Mark Read" })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkUnreadBatch}
              title={t("notifications:inbox.markUnread", { defaultValue: "Mark as Unread" })}
              className="h-8 px-2.5"
            >
              <Mail className="w-4 h-4 me-1.5 text-[var(--t3)]" />
              <span>{t("notifications:inbox.markUnread", { defaultValue: "Mark Unread" })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteBatch}
              title={t("notifications:inbox.deleteSelected", { defaultValue: "Delete Selected" })}
              className="h-8 px-2.5 text-[var(--red)] hover:bg-[var(--red)]/10"
            >
              <Trash2 className="w-4 h-4 me-1.5" />
              <span>{t("notifications:inbox.remove", { defaultValue: "Delete" })}</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              loading={isHydrating}
              title={t("common:actions.refresh", { defaultValue: "Refresh" })}
              className="h-8 px-2.5 text-[var(--t3)] hover:text-[var(--t1)]"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-8 px-2.5 text-xs font-medium text-[var(--t2)] hover:text-[var(--t1)]"
            >
              {t("notifications:inbox.markAllRead", { defaultValue: "Mark all as read" })}
            </Button>
          </div>
        )}
      </div>

      {/* Right: Real-time Search Input */}
      <div className="relative w-full sm:w-64">
        <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--t3)] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("notifications:inbox.searchPlaceholder", { defaultValue: "Search notifications..." })}
          className="w-full bg-[var(--s2)] border border-[var(--b)] rounded-xl py-1.5 ps-9 pe-3 text-xs text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition-all"
        />
      </div>
    </div>
  );
};

export default InboxToolbar;
