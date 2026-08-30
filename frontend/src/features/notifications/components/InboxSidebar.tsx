import React from "react";
import { useTranslation } from "react-i18next";
import {
  Inbox,
  Mail,
  Archive,
  Video,
  GraduationCap,
  Film,
  CreditCard,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxCategory, NotificationItem } from "../store/notificationsStore";

export interface InboxSidebarProps {
  activeCategory: InboxCategory;
  onSelectCategory: (cat: InboxCategory) => void;
  items: NotificationItem[];
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({
  activeCategory,
  onSelectCategory,
  items,
}) => {
  const { t } = useTranslation(["notifications", "common"]);

  // Calculate real-time counts
  const unreadCount = items.filter((it) => it.readAt === null).length;
  const readCount = items.filter((it) => it.readAt !== null).length;
  const roomsCount = items.filter(
    (it) => it.kind === "ROOM_INVITE" || it.kind === "SESSION_STARTED"
  ).length;
  const academicCount = items.filter((it) => it.kind === "ASSESSMENT_GRADED").length;
  const recordingsCount = items.filter(
    (it) =>
      it.kind === "RECORDING_PUBLISHED" ||
      it.kind === "RECORDING_PERMISSION_GRANTED" ||
      it.kind === "RECORDING_PERMISSION_REVOKED"
  ).length;
  const financialCount = items.filter(
    (it) => it.kind === "INVOICE_CREATED" || it.kind === "INVOICE_UPDATED"
  ).length;
  const systemCount = items.filter((it) => it.kind === "IN_APP").length;

  const categories: Array<{
    id: InboxCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    badgeVariant?: "brand" | "neutral" | "success" | "warning";
  }> = [
    {
      id: "all",
      label: t("notifications:inbox.categories.all", { defaultValue: "All Notifications" }),
      icon: Inbox,
      count: items.length,
    },
    {
      id: "unread",
      label: t("notifications:inbox.categories.unread", { defaultValue: "Unread" }),
      icon: Mail,
      count: unreadCount,
      badgeVariant: "brand",
    },
    {
      id: "read",
      label: t("notifications:inbox.categories.read", { defaultValue: "Read & Archived" }),
      icon: Archive,
      count: readCount,
    },
    {
      id: "rooms",
      label: t("notifications:inbox.categories.rooms", { defaultValue: "Live & Rooms" }),
      icon: Video,
      count: roomsCount,
    },
    {
      id: "academic",
      label: t("notifications:inbox.categories.academic", { defaultValue: "Academic & Exams" }),
      icon: GraduationCap,
      count: academicCount,
    },
    {
      id: "recordings",
      label: t("notifications:inbox.categories.recordings", { defaultValue: "Recordings" }),
      icon: Film,
      count: recordingsCount,
    },
    {
      id: "financial",
      label: t("notifications:inbox.categories.financial", { defaultValue: "Finance & Invoices" }),
      icon: CreditCard,
      count: financialCount,
    },
    {
      id: "system",
      label: t("notifications:inbox.categories.system", { defaultValue: "System & Broadcasts" }),
      icon: Bell,
      count: systemCount,
    },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1 p-3 bg-[var(--s1)] border-b md:border-b-0 md:border-e border-[var(--b)] rounded-2xl md:rounded-none">
      <div className="px-3 py-2 text-xs font-bold text-[var(--t3)] uppercase tracking-wider">
        {t("notifications:inbox.folders", { defaultValue: "Folders & Categories" })}
      </div>
      <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-start shrink-0 cursor-pointer",
                isActive
                  ? "bg-[var(--brand)] text-white font-semibold shadow-md shadow-[var(--brand)]/20"
                  : "text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-white" : "text-[var(--t3)]"
                  )}
                />
                <span className="truncate">{cat.label}</span>
              </div>
              {cat.count > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-full font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : cat.badgeVariant === "brand"
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--s3)] text-[var(--t3)]"
                  )}
                >
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings Section (Consolidated Hub) */}
      <div className="mt-auto pt-2 border-t border-[var(--b)] flex flex-col gap-1">
        <button
          onClick={() => onSelectCategory("settings")}
          className={cn(
            "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-start shrink-0 cursor-pointer",
            activeCategory === "settings"
              ? "bg-[var(--brand)] text-white font-semibold shadow-md shadow-[var(--brand)]/20"
              : "text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--t1)]"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings
              className={cn(
                "w-4 h-4 shrink-0",
                activeCategory === "settings" ? "text-white" : "text-[var(--t3)]"
              )}
            />
            <span className="truncate">
              {t("notifications:inbox.categories.settings", {
                defaultValue: "تنظیمات اعلان‌ها",
              })}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
};

export default InboxSidebar;
