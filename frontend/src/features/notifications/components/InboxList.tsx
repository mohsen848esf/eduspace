import React from "react";
import { useTranslation } from "react-i18next";
import {
  Video,
  Film,
  GraduationCap,
  CreditCard,
  Bell,
  MailCheck,
  Mail,
  Trash2,
  Square,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import type { NotificationItem } from "../store/notificationsStore";

export interface InboxListProps {
  items: NotificationItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onItemClick: (item: NotificationItem) => void;
  onMarkRead: (id: string, e: React.MouseEvent) => void;
  onMarkUnread: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onActionClick: (item: NotificationItem, e: React.MouseEvent) => void;
  localeTag?: string;
}

function getNotificationDetails(item: NotificationItem, t: any) {
  const { kind, data } = item;

  switch (kind) {
    case "ROOM_INVITE":
      return {
        icon: Video,
        iconBg: "bg-[var(--cyan)]/15 text-[var(--cyan)]",
        title: (data.from as string) || t("notifications:roomInvite.title", { from: "Teacher", defaultValue: "Room Invite" }),
        subtitle: (data.room_name as string) || (data.room_code as string) || "Live Room",
        actionLabel: t("notifications:roomInvite.joinNow", { defaultValue: "Join Room" }),
        category: "rooms",
      };
    case "SESSION_STARTED":
      return {
        icon: Video,
        iconBg: "bg-[var(--green)]/15 text-[var(--green)]",
        title: (data.host_name as string) || t("notifications:sessionStarted.title", { defaultValue: "Class Started" }),
        subtitle: (data.class_name as string) || "Live Session",
        actionLabel: t("notifications:sessionStarted.join", { defaultValue: "Join Class" }),
        category: "rooms",
      };
    case "RECORDING_PUBLISHED":
      return {
        icon: Film,
        iconBg: "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30",
        title: (data.from as string) || t("recordings:title", { defaultValue: "New Recording" }),
        subtitle: (data.room_name as string) || "Session Recording",
        actionLabel: t("recordings:notification.watch", { defaultValue: "Watch" }),
        category: "recordings",
      };
    case "RECORDING_PERMISSION_GRANTED":
    case "RECORDING_PERMISSION_REVOKED":
      return {
        icon: Film,
        iconBg: "bg-[var(--amber)]/15 text-[var(--amber)]",
        title: (data.from as string) || "Recording Permission",
        subtitle: (data.room_name as string) || "Live Room",
        actionLabel: t("notifications:recordingPermission.openRoom", { defaultValue: "Open Room" }),
        category: "recordings",
      };
    case "ASSESSMENT_GRADED":
      return {
        icon: GraduationCap,
        iconBg: "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30",
        title: (data.assessment_title as string) || t("notifications:assessmentGraded.title", { defaultValue: "Assessment Graded" }),
        subtitle: `Score: ${data.score ?? "-"} / ${data.total_points ?? "-"}`,
        actionLabel: t("notifications:assessmentGraded.view", { defaultValue: "View Results" }),
        category: "academic",
      };
    case "INVOICE_CREATED":
    case "INVOICE_UPDATED":
      return {
        icon: CreditCard,
        iconBg: "bg-[var(--amber)]/15 text-[var(--amber)]",
        title: (data.invoice_number as string) || t("notifications:invoiceCreated.title", { defaultValue: "Tuition Invoice" }),
        subtitle: `Amount: $${data.amount ?? "0"} · ${data.status ?? "Issued"}`,
        actionLabel: t("notifications:invoiceCreated.pay", { defaultValue: "View Invoice" }),
        category: "financial",
      };
    case "IN_APP":
    default:
      return {
        icon: Bell,
        iconBg: "bg-[var(--s3)] text-[var(--t2)]",
        title: (data.title as string) || t("notifications:inbox.detail.systemAnnouncement", { defaultValue: "System Announcement" }),
        subtitle: (data.message as string) || "Notification message",
        actionLabel: t("common:actions.view", { defaultValue: "View" }),
        category: "system",
      };
  }
}

function formatTimestamp(ms: number, t: any, localeTag = "fa-IR"): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t("notifications:inbox.detail.justNow", { defaultValue: "Just now" });
  if (min < 60) return t("notifications:inbox.detail.minutesAgo", { count: min, defaultValue: `${min}m ago` });
  const h = Math.floor(min / 60);
  if (h < 24) return t("notifications:inbox.detail.hoursAgo", { count: h, defaultValue: `${h}h ago` });
  const d = Math.floor(h / 24);
  if (d < 7) return t("notifications:inbox.detail.daysAgo", { count: d, defaultValue: `${d}d ago` });

  return new Date(ms).toLocaleDateString(localeTag, {
    month: "short",
    day: "numeric",
  });
}

export const InboxList: React.FC<InboxListProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onItemClick,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onActionClick,
  localeTag = "fa-IR",
}) => {
  const { t } = useTranslation(["notifications", "recordings", "common"]);

  if (items.length === 0) {
    return (
      <div className="p-12 flex justify-center items-center">
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title={t("notifications:inbox.empty", { defaultValue: "No notifications found" })}
          description={t("notifications:inbox.emptyHint", {
            defaultValue: "Your notification inbox is completely up to date.",
          })}
        />
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--b)]/60 bg-[var(--s0)]">
      {items.map((item) => {
        const isSelected = selectedIds.has(item.id);
        const isUnread = item.readAt === null;
        const details = getNotificationDetails(item, t);
        const IconComponent = details.icon;

        return (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className={cn(
              "group relative flex items-center gap-3 px-4 py-3.5 transition-all cursor-pointer",
              "hover:bg-[var(--s1)]",
              isUnread ? "bg-[var(--s1)]/80 font-semibold" : "bg-[var(--s0)] opacity-90",
              isSelected && "bg-[var(--brand-soft)]/30 hover:bg-[var(--brand-soft)]/40"
            )}
          >
            {/* Checkbox */}
            <button
              type="button"
              onClick={(e) => onToggleSelect(item.id, e)}
              className="p-1 text-[var(--t3)] hover:text-[var(--brand)] rounded transition-colors cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>

            {/* Unread Indicator Dot */}
            <div className="w-2 flex justify-center shrink-0">
              {isUnread && (
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] shadow-sm shadow-[var(--brand)]/50" />
              )}
            </div>

            {/* Category Icon */}
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-transparent shadow-xs",
                details.iconBg
              )}
            >
              <IconComponent className="w-4 h-4" />
            </div>

            {/* Sender / Title */}
            <div className="w-36 md:w-44 shrink-0 truncate text-xs font-bold text-[var(--t1)]">
              {details.title}
            </div>

            {/* Message Snippet */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span
                className={cn(
                  "text-xs truncate",
                  isUnread ? "text-[var(--t1)]" : "text-[var(--t2)] font-normal"
                )}
              >
                {details.subtitle}
              </span>
            </div>

            {/* Right: Timestamp */}
            <div className="text-[11px] text-[var(--t3)] shrink-0 group-hover:hidden transition-all force-ltr">
              {formatTimestamp(item.receivedAt, t, localeTag)}
            </div>

            {/* Hover Quick Action Toolbar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="hidden group-hover:flex items-center gap-1.5 shrink-0 animate-in fade-in"
            >
              <button
                type="button"
                onClick={(e) => onActionClick(item, e)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] transition-colors shadow-xs cursor-pointer"
              >
                <span>{details.actionLabel}</span>
              </button>

              {isUnread ? (
                <button
                  type="button"
                  onClick={(e) => onMarkRead(item.id, e)}
                  title={t("notifications:inbox.markRead", { defaultValue: "Mark as read" })}
                  className="p-1.5 rounded-lg text-[var(--t3)] hover:text-[var(--brand)] hover:bg-[var(--s2)] transition-colors cursor-pointer"
                >
                  <MailCheck className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => onMarkUnread(item.id, e)}
                  title={t("notifications:inbox.markUnread", { defaultValue: "Mark as unread" })}
                  className="p-1.5 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s2)] transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => onDelete(item.id, e)}
                title={t("notifications:inbox.remove", { defaultValue: "Delete" })}
                className="p-1.5 rounded-lg text-[var(--t3)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InboxList;
