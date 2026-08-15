import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppShell from "@/components/layout/AppShell";
import { useLocale } from "@/i18n/useLocale";
import {
  useNotificationsStore,
  type InboxCategory,
  type NotificationItem,
} from "../store/notificationsStore";
import InboxSidebar from "../components/InboxSidebar";
import InboxToolbar from "../components/InboxToolbar";
import InboxList from "../components/InboxList";
import InboxDetailDrawer from "../components/InboxDetailDrawer";

export default function InboxPage() {
  const { t } = useTranslation(["notifications", "common"]);
  const { language } = useLocale();
  const navigate = useNavigate();

  const isFarsi = language === "fa";
  const localeTag = isFarsi ? "fa-IR" : "en-US";

  // Zustand Store
  const items = useNotificationsStore((s) => s.items);
  const isHydrating = useNotificationsStore((s) => s.isHydrating);
  const hydrate = useNotificationsStore((s) => s.hydrate);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markUnread = useNotificationsStore((s) => s.markUnread);
  const markReadBatch = useNotificationsStore((s) => s.markReadBatch);
  const markUnreadBatch = useNotificationsStore((s) => s.markUnreadBatch);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const deleteBatch = useNotificationsStore((s) => s.deleteBatch);

  // Local UI State
  const [activeCategory, setActiveCategory] = useState<InboxCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<NotificationItem | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Filter items by category & search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category Filter
      if (activeCategory === "unread" && item.readAt !== null) return false;
      if (activeCategory === "read" && item.readAt === null) return false;
      if (activeCategory === "rooms" && item.kind !== "ROOM_INVITE" && item.kind !== "SESSION_STARTED") return false;
      if (activeCategory === "academic" && item.kind !== "ASSESSMENT_GRADED") return false;
      if (
        activeCategory === "recordings" &&
        item.kind !== "RECORDING_PUBLISHED" &&
        item.kind !== "RECORDING_PERMISSION_GRANTED" &&
        item.kind !== "RECORDING_PERMISSION_REVOKED"
      )
        return false;
      if (activeCategory === "financial" && item.kind !== "INVOICE_CREATED" && item.kind !== "INVOICE_UPDATED") return false;
      if (activeCategory === "system" && item.kind !== "IN_APP") return false;

      // 2. Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const strValues = Object.values(item.data).join(" ").toLowerCase();
        const matchesKind = item.kind.toLowerCase().includes(query);
        const matchesData = strValues.includes(query);
        if (!matchesKind && !matchesData) return false;
      }

      return true;
    });
  }, [items, activeCategory, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredItems.map((it) => it.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  // Batch action handlers
  const handleMarkReadBatch = () => {
    markReadBatch(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleMarkUnreadBatch = () => {
    markUnreadBatch(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleDeleteBatch = () => {
    deleteBatch(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // Action Navigation Handler
  const handleActionClick = (item: NotificationItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    markRead(item.id);

    const { kind, data } = item;
    if (kind === "ROOM_INVITE") {
      const link = (data.invite_link as string) || `/room/${data.room_code || ""}`;
      navigate(link);
    } else if (kind === "SESSION_STARTED") {
      navigate(`/room/${data.room_code || ""}`);
    } else if (kind === "RECORDING_PUBLISHED") {
      const link = (data.watch_link as string) || (data.recording_token ? `/recordings/${data.recording_token}` : "/recordings");
      navigate(link);
    } else if (kind === "ASSESSMENT_GRADED") {
      navigate("/academic/assessments");
    } else if (kind === "INVOICE_CREATED" || kind === "INVOICE_UPDATED") {
      navigate("/finance/ledger");
    } else {
      setSelectedItemForDetail(item);
    }
  };

  return (
    <AppShell
      title={t("notifications:inbox.title", { defaultValue: "Notifications Inbox" })}
      subtitle={t("notifications:inbox.subtitle", {
        defaultValue: "Centralized inbox for invites, classes, grades, and invoices",
      })}
      activeNav="inbox"
    >
      <div className="flex flex-col md:flex-row bg-[var(--s1)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm min-h-[calc(100vh-200px)]">
        {/* Left: Gmail-style Category Sidebar */}
        <InboxSidebar
          activeCategory={activeCategory}
          onSelectCategory={(cat) => {
            setActiveCategory(cat);
            setSelectedIds(new Set());
          }}
          items={items}
        />

        {/* Right: Main Content (Toolbar + List) */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--s0)]">
          <InboxToolbar
            selectedCount={selectedIds.size}
            totalVisibleCount={filteredItems.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
            onMarkReadBatch={handleMarkReadBatch}
            onMarkUnreadBatch={handleMarkUnreadBatch}
            onDeleteBatch={handleDeleteBatch}
            onMarkAllRead={markAllRead}
            onRefresh={hydrate}
            isHydrating={isHydrating}
          />

          <div className="flex-1 overflow-y-auto">
            <InboxList
              items={filteredItems}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onItemClick={(item) => {
                markRead(item.id);
                setSelectedItemForDetail(item);
              }}
              onMarkRead={(id, e) => {
                e.stopPropagation();
                markRead(id);
              }}
              onMarkUnread={(id, e) => {
                e.stopPropagation();
                markUnread(id);
              }}
              onDelete={(id, e) => {
                e.stopPropagation();
                remove(id);
              }}
              onActionClick={handleActionClick}
              localeTag={localeTag}
            />
          </div>
        </main>
      </div>

      {/* Slide-in Detail Drawer */}
      <InboxDetailDrawer
        item={selectedItemForDetail}
        onClose={() => setSelectedItemForDetail(null)}
        onMarkRead={markRead}
        onMarkUnread={markUnread}
        onDelete={remove}
        onPrimaryAction={(item) => {
          setSelectedItemForDetail(null);
          handleActionClick(item);
        }}
        localeTag={localeTag}
      />
    </AppShell>
  );
}
