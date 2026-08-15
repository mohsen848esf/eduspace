import React from "react";
import {
  X,
  Calendar,
  ExternalLink,
  Trash2,
  MailCheck,
  Mail,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { NotificationItem } from "../store/notificationsStore";

export interface InboxDetailDrawerProps {
  item: NotificationItem | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDelete: (id: string) => void;
  onPrimaryAction: (item: NotificationItem) => void;
  localeTag?: string;
}

export const InboxDetailDrawer: React.FC<InboxDetailDrawerProps> = ({
  item,
  onClose,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onPrimaryAction,
  localeTag = "fa-IR",
}) => {
  if (!item) return null;

  const isUnread = item.readAt === null;
  const { kind, data } = item;

  const dateString = new Date(item.receivedAt).toLocaleDateString(localeTag, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg h-full bg-[var(--s1)] border-s border-[var(--b)] shadow-2xl flex flex-col justify-between animate-in slide-in-from-end duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--b)]">
          <div className="flex items-center gap-2">
            <Badge variant={isUnread ? "brand" : "neutral"} dot={isUnread}>
              {isUnread ? "خوانده‌نشده" : "خوانده‌شده"}
            </Badge>
            <span className="text-xs text-[var(--t3)]">{kind}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s2)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Card */}
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
              <Calendar className="w-4 h-4 text-[var(--brand)]" />
              <span>{dateString}</span>
            </div>

            {data.from !== undefined && (
              <div className="text-sm">
                <span className="text-[var(--t3)]">فرستنده: </span>
                <span className="font-bold text-[var(--t1)]">{String(data.from)}</span>
              </div>
            )}
          </div>

          {/* Detailed Message Section */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-[var(--t1)]">
              {String(data.title || data.room_name || data.assessment_title || data.invoice_number || "اعلان سامانه")}
            </h3>

            {data.message !== undefined && (
              <p className="text-sm text-[var(--t2)] leading-relaxed bg-[var(--s0)] p-4 rounded-xl border border-[var(--b)]/60">
                {String(data.message)}
              </p>
            )}

            {/* Kind-specific visual helpers */}
            {kind === "ROOM_INVITE" && (
              <div className="p-4 rounded-xl bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 space-y-2">
                <div className="text-xs font-semibold text-[var(--cyan)]">اطلاعات اتاق آنلاین</div>
                <div className="text-xs text-[var(--t2)]">کد اتاق: {String(data.room_code || "-")}</div>
              </div>
            )}

            {kind === "ASSESSMENT_GRADED" && (
              <div className="p-4 rounded-xl bg-[var(--brand-soft)]/20 border border-[var(--brand)]/20 space-y-2">
                <div className="text-xs font-semibold text-[var(--brand-text)]">نتیجه ارزیابی</div>
                <div className="text-sm font-extrabold text-[var(--t1)]">
                  نمره نهایی: {String(data.score ?? "-")} از {String(data.total_points ?? "-")}
                </div>
              </div>
            )}

            {kind === "INVOICE_CREATED" && (
              <div className="p-4 rounded-xl bg-[var(--amber)]/10 border border-[var(--amber)]/20 space-y-2">
                <div className="text-xs font-semibold text-[var(--amber)]">صورتحساب مالی</div>
                <div className="text-sm font-extrabold text-[var(--t1)]">
                  مبلغ: ${String(data.amount ?? "0")}
                </div>
              </div>
            )}
          </div>

          {/* Primary Call to Action */}
          <div className="pt-4">
            <Button
              fullWidth
              size="lg"
              onClick={() => onPrimaryAction(item)}
              className="font-bold flex items-center justify-center gap-2"
            >
              <span>مشاهده و باز کردن مقصد</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--b)] bg-[var(--s1)]">
          <div className="flex items-center gap-2">
            {isUnread ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onMarkRead(item.id)}
              >
                <MailCheck className="w-4 h-4 me-1.5" />
                <span>علامت به عنوان خوانده‌شده</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onMarkUnread(item.id)}
              >
                <Mail className="w-4 h-4 me-1.5" />
                <span>علامت به عنوان خوانده‌نشده</span>
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDelete(item.id);
              onClose();
            }}
            className="text-[var(--red)] hover:bg-[var(--red)]/10"
          >
            <Trash2 className="w-4 h-4 me-1.5" />
            <span>حذف</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InboxDetailDrawer;
