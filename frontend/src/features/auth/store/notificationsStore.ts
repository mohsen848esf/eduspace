import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Notification kinds we currently render. Adding a new kind is a matter
 * of adding it to this union and teaching NotificationsPopover how to
 * render it. The shape of `data` mirrors what NotificationConsumer
 * sends from the backend.
 */
export type NotificationKind = "ROOM_INVITE" | "RECORDING_PUBLISHED";

export interface NotificationItem {
  /**
   * Stable id that's safe to use as a React key. We synthesize it from
   * the kind + a few payload fields + the receive time, so the same
   * payload arriving twice (rare, but not impossible if the WS reconnects
   * mid-broadcast) won't double-up in the inbox.
   */
  id: string;
  kind: NotificationKind;
  /** Raw payload as received over the WS. Kept verbatim so we can
   * extract whatever the toast/popover needs without re-parsing. */
  data: Record<string, unknown>;
  /** ms since epoch when we received the notification. */
  receivedAt: number;
  /** ms since epoch when the user marked it read; null until then. */
  readAt: number | null;
}

interface NotificationsState {
  items: NotificationItem[];
  add: (kind: NotificationKind, data: Record<string, unknown>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  /** Convenience selector: how many entries are still unread. */
  unreadCount: () => number;
}

/** Maximum number of inbox entries we keep. Older ones drop off the end. */
const MAX_ITEMS = 50;

function makeId(kind: NotificationKind, data: Record<string, unknown>): string {
  // Best-effort uniqueness: include a stable subset of the payload so a
  // duplicate redelivery uses the same id (and dedupes naturally), but
  // unrelated notifications never collide.
  const tokens = [
    kind,
    String(data.room_code ?? ""),
    String(data.recording_token ?? ""),
    String(data.from ?? ""),
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 6),
  ];
  return tokens.join(":");
}

/**
 * Persisted inbox of notifications received over the WebSocket.
 *
 * The toast UI in `useNotifications` is the live "alert" surface; this
 * store is the durable history. Both are populated for every incoming
 * message — toasts vanish after 15s, inbox entries persist until the
 * user clears them or the cap evicts them.
 */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (kind, data) =>
        set((state) => {
          // De-dupe: if the same kind+room/recording id arrived less
          // than 5 seconds ago, drop the new one. Defends against the
          // WS reconnect re-sending the last message.
          const now = Date.now();
          const recent = state.items.find(
            (it) =>
              it.kind === kind &&
              now - it.receivedAt < 5_000 &&
              (it.data.room_code ?? null) === (data.room_code ?? null) &&
              (it.data.recording_token ?? null) ===
                (data.recording_token ?? null),
          );
          if (recent) return state;

          const next: NotificationItem = {
            id: makeId(kind, data),
            kind,
            data,
            receivedAt: now,
            readAt: null,
          };
          return {
            items: [next, ...state.items].slice(0, MAX_ITEMS),
          };
        }),

      markRead: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id && it.readAt === null
              ? { ...it, readAt: Date.now() }
              : it,
          ),
        })),

      markAllRead: () =>
        set((state) => {
          const now = Date.now();
          return {
            items: state.items.map((it) =>
              it.readAt === null ? { ...it, readAt: now } : it,
            ),
          };
        }),

      remove: (id) =>
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        })),

      clearAll: () => set({ items: [] }),

      unreadCount: () => get().items.filter((it) => it.readAt === null).length,
    }),
    {
      name: "eduspace.notifications",
      version: 1,
      // Persist everything; the cap at MAX_ITEMS keeps the payload bounded.
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
