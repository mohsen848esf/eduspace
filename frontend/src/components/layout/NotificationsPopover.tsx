import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useNotificationsStore,
  type NotificationItem,
} from "../../features/auth/store/notificationsStore";
import { Icons } from "../../lib/constants/icons";
import { cn } from "../../lib/utils";

interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
  /** Anchor reference for click-outside detection. Click events on the
   *  anchor itself are ignored so the toggle works as expected. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(ms).toLocaleDateString();
}

/**
 * Dropdown panel that anchors to the topbar's bell button. Lists every
 * notification we've received recently (most-recent first), highlights
 * unread ones, and exposes the same actions the original toast offered
 * (Join the room, Watch the recording).
 *
 * Implementation note: this is a plain absolutely-positioned popover
 * rather than a radix Popover because we already had the topbar's local
 * anchor; pulling in another primitive would have meant restructuring
 * Topbar more than this small feature is worth.
 */
export default function NotificationsPopover({
  open,
  onClose,
  anchorRef,
}: NotificationsPopoverProps) {
  const { t, i18n } = useTranslation(["notifications", "recordings", "common"]);
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const clearAll = useNotificationsStore((s) => s.clearAll);

  const unreadCount = useMemo(
    () => items.filter((it) => it.readAt === null).length,
    [items],
  );

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click. The anchor is excluded so the bell toggles.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, anchorRef, onClose]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleAction = (item: NotificationItem) => {
    markRead(item.id);
    if (item.kind === "ROOM_INVITE") {
      const link =
        (item.data.invite_link as string) ||
        (item.data.room_code
          ? `/room/${item.data.room_code}`
          : "/dashboard");
      navigate(link);
    } else if (item.kind === "RECORDING_PUBLISHED") {
      const link =
        (item.data.watch_link as string) ||
        (item.data.recording_token
          ? `/recordings/${item.data.recording_token}`
          : "/recordings");
      navigate(link);
    } else if (
      item.kind === "RECORDING_PERMISSION_GRANTED" ||
      item.kind === "RECORDING_PERMISSION_REVOKED"
    ) {
      // Both kinds have a room_code; the action takes the user back
      // into that room so the new permission state is immediately
      // useful (or the revoke is acknowledged).
      const link = item.data.room_code
        ? `/room/${item.data.room_code}`
        : "/dashboard";
      navigate(link);
    }
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t("notifications:inbox.title")}
      lang={i18n.language}
      className={cn(
        "absolute top-10 end-0 z-50",
        "w-80 max-w-[calc(100vw-1.5rem)] max-h-[70vh]",
        "bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl",
        "flex flex-col fade-in",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--b)] flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-[var(--t1)]">
            {t("notifications:inbox.title")}
          </div>
          {unreadCount > 0 && (
            <div className="text-[11px] text-[var(--t3)]">
              {t("notifications:inbox.unreadCount", { count: unreadCount })}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-[var(--brand-text)] bg-transparent border-none cursor-pointer hover:underline"
              >
                {t("notifications:inbox.markAllRead")}
              </button>
            )}
            <button
              onClick={clearAll}
              aria-label={t("notifications:inbox.clearAll")}
              className="w-7 h-7 rounded-md bg-transparent border-none cursor-pointer text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
            <span className="text-2xl" aria-hidden>
              🔕
            </span>
            <p className="text-xs text-[var(--t1)] font-semibold">
              {t("notifications:inbox.empty")}
            </p>
            <p className="text-[11px] text-[var(--t3)]">
              {t("notifications:inbox.emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onClick={() => handleAction(item)}
                onMarkRead={() => markRead(item.id)}
                onRemove={() => remove(item.id)}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface NotificationRowProps {
  item: NotificationItem;
  onClick: () => void;
  onMarkRead: () => void;
  onRemove: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function NotificationRow({
  item,
  onClick,
  onMarkRead,
  onRemove,
  t,
}: NotificationRowProps) {
  const isUnread = item.readAt === null;
  const data = item.data;

  let title = "";
  let subtitle = "";
  let actionLabel = "";
  let icon: React.ReactNode = null;

  if (item.kind === "ROOM_INVITE") {
    icon = Icons.camera;
    title = t("notifications:roomInvite.title", { from: data.from ?? "" });
    subtitle = (data.room_name as string) || (data.room_code as string) || "";
    actionLabel = t("notifications:roomInvite.joinNow");
  } else if (item.kind === "RECORDING_PUBLISHED") {
    icon = Icons.film;
    title = t("recordings:notification.publishedTitle", {
      from: data.from ?? "",
    });
    subtitle =
      (data.room_name as string) ||
      (data.room_code as string) ||
      t("recordings:notification.watch");
    actionLabel = t("recordings:notification.watch");
  } else if (item.kind === "RECORDING_PERMISSION_GRANTED") {
    icon = Icons.film;
    title = t("notifications:recordingPermission.grantedTitle", {
      from: data.from ?? "",
    });
    subtitle =
      (data.room_name as string) || (data.room_code as string) || "";
    actionLabel = t("notifications:recordingPermission.openRoom");
  } else if (item.kind === "RECORDING_PERMISSION_REVOKED") {
    icon = Icons.film;
    title = t("notifications:recordingPermission.revokedTitle", {
      from: data.from ?? "",
    });
    subtitle =
      (data.room_name as string) || (data.room_code as string) || "";
    actionLabel = t("notifications:recordingPermission.openRoom");
  }

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 border-b border-[var(--b)] last:border-b-0",
        isUnread && "bg-[var(--brand-soft)]/40",
      )}
    >
      <span
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          "bg-[var(--s3)] text-[var(--t2)]",
          "[&>svg]:w-4 [&>svg]:h-4",
        )}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <button
          onClick={onClick}
          className="text-start bg-transparent border-none cursor-pointer p-0"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-[var(--t1)] truncate">
              {title}
            </span>
            {isUnread && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] flex-shrink-0"
                aria-label={t("notifications:inbox.unreadDot")}
              />
            )}
          </div>
          {subtitle && (
            <div className="text-[11px] text-[var(--t3)] truncate">
              {subtitle}
            </div>
          )}
          <div className="text-[10px] text-[var(--t3)] mt-0.5 force-ltr">
            {formatRelative(item.receivedAt)}
          </div>
        </button>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onClick}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] transition-colors"
          >
            {actionLabel}
          </button>
          {isUnread && (
            <button
              onClick={onMarkRead}
              className="text-[11px] text-[var(--t3)] bg-transparent border-none cursor-pointer hover:text-[var(--t1)] hover:underline"
            >
              {t("notifications:inbox.markRead")}
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-[11px] text-[var(--t3)] bg-transparent border-none cursor-pointer hover:text-[var(--red)] hover:underline ms-auto"
          >
            {t("notifications:inbox.remove")}
          </button>
        </div>
      </div>
    </li>
  );
}
