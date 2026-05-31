import { create } from "zustand";
import { persist } from "zustand/middleware";
import client from "../../../lib/api/client";

/**
 * Notification kinds we currently render. Adding a new kind is a matter
 * of adding it to this union and teaching NotificationsPopover how to
 * render it. The shape of `data` mirrors what NotificationConsumer
 * sends from the backend.
 */
export type NotificationKind =
  | "ROOM_INVITE"
  | "RECORDING_PUBLISHED"
  | "RECORDING_PERMISSION_GRANTED"
  | "RECORDING_PERMISSION_REVOKED";

export interface NotificationItem {
  /**
   * Stable id that's safe to use as a React key. When the backend
   * delivered the item we synthesise the id from the server's pk
   * (`srv:<n>`); when the WS arrives ahead of any persisted record we
   * fall back to a kind+payload+random suffix.
   */
  id: string;
  /** The server-side primary key, when known. Lets us call the inbox
   *  REST endpoints (mark-read / delete) instead of just mutating
   *  local state. */
  serverId?: number;
  kind: NotificationKind;
  /** Raw payload as received over the WS or REST. Kept verbatim so we
   * can extract whatever the toast/popover needs without re-parsing. */
  data: Record<string, unknown>;
  /** ms since epoch when we received the notification. */
  receivedAt: number;
  /** ms since epoch when the user marked it read; null until then. */
  readAt: number | null;
}

interface NotificationsState {
  items: NotificationItem[];
  /** True while the initial REST hydrate is in flight. */
  isHydrating: boolean;
  /** ms since epoch of the last successful hydrate, or 0. */
  lastHydratedAt: number;

  add: (
    kind: NotificationKind,
    data: Record<string, unknown>,
    opts?: { serverId?: number; createdAt?: string },
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  /** Convenience selector: how many entries are still unread. */
  unreadCount: () => number;
  /** Pull the inbox from the server and replace local state. Idempotent
   *  — running it a second time returns the latest server snapshot. */
  hydrate: () => Promise<void>;
}

/** Maximum number of inbox entries we keep. Older ones drop off the end. */
const MAX_ITEMS = 50;

function makeLocalId(kind: NotificationKind, data: Record<string, unknown>): string {
  // Best-effort uniqueness for items that arrived via the WS without a
  // server id (rare; mostly during the brief window before
  // record_and_dispatch's WS push includes the id field).
  const tokens = [
    "loc",
    kind,
    String(data.room_code ?? ""),
    String(data.recording_token ?? ""),
    String(data.from ?? ""),
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 6),
  ];
  return tokens.join(":");
}

interface ServerNotification {
  id: number;
  kind: NotificationKind;
  data: Record<string, unknown>;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

function fromServer(n: ServerNotification): NotificationItem {
  return {
    id: `srv:${n.id}`,
    serverId: n.id,
    kind: n.kind,
    data: n.data ?? {},
    receivedAt: Date.parse(n.created_at) || Date.now(),
    readAt: n.read_at ? Date.parse(n.read_at) : null,
  };
}

/**
 * Persisted inbox of notifications.
 *
 * Two write paths:
 *   1. The WebSocket fires `add(kind, data, { serverId, createdAt })`
 *      when realtime delivery succeeds (record_and_dispatch includes
 *      the persisted row's id in the WS payload).
 *   2. `hydrate()` runs after login, fetches `/api/auth/notifications/`,
 *      and replaces the inbox with whatever the backend has stored.
 *      That covers the case where a notification was sent while the
 *      user was offline.
 *
 * The toast UI in `useNotifications` is the live "alert" surface;
 * this store is the durable history. Both are populated on every
 * incoming WS message — toasts vanish after 15s, inbox entries persist
 * until the user clears them or the cap evicts them.
 */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      isHydrating: false,
      lastHydratedAt: 0,

      add: (kind, data, opts) =>
        set((state) => {
          // Server-known items dedupe by serverId. If we already have a
          // row with the same serverId, treat the call as a no-op so
          // the WS replay after reconnect doesn't double-insert.
          if (opts?.serverId !== undefined) {
            const dupe = state.items.find(
              (it) => it.serverId === opts.serverId,
            );
            if (dupe) return state;
          }

          // For purely local items (no serverId), fall back to a 5s
          // window dedupe by kind + room/recording — defends against
          // WS reconnect mid-broadcast.
          const now = Date.now();
          if (opts?.serverId === undefined) {
            const recent = state.items.find(
              (it) =>
                !it.serverId &&
                it.kind === kind &&
                now - it.receivedAt < 5_000 &&
                (it.data.room_code ?? null) === (data.room_code ?? null) &&
                (it.data.recording_token ?? null) ===
                  (data.recording_token ?? null),
            );
            if (recent) return state;
          }

          const receivedAt = opts?.createdAt
            ? Date.parse(opts.createdAt) || now
            : now;
          const next: NotificationItem = {
            id:
              opts?.serverId !== undefined
                ? `srv:${opts.serverId}`
                : makeLocalId(kind, data),
            serverId: opts?.serverId,
            kind,
            data,
            receivedAt,
            readAt: null,
          };
          return {
            items: [next, ...state.items].slice(0, MAX_ITEMS),
          };
        }),

      markRead: (id) => {
        const item = get().items.find((it) => it.id === id);
        // Optimistic local update first.
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id && it.readAt === null
              ? { ...it, readAt: Date.now() }
              : it,
          ),
        }));
        // Persist if the item has a server id.
        if (item?.serverId) {
          client
            .post(`/auth/notifications/${item.serverId}/read/`)
            .catch(() => {
              /* swallow — local state already updated */
            });
        }
      },

      markAllRead: () => {
        const now = Date.now();
        const ids = get()
          .items.filter((it) => it.readAt === null && it.serverId)
          .map((it) => it.serverId!);
        set((state) => ({
          items: state.items.map((it) =>
            it.readAt === null ? { ...it, readAt: now } : it,
          ),
        }));
        if (ids.length > 0) {
          client.post(`/auth/notifications/read-all/`).catch(() => {
            /* swallow */
          });
        }
      },

      remove: (id) => {
        const item = get().items.find((it) => it.id === id);
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        }));
        if (item?.serverId) {
          client
            .delete(`/auth/notifications/${item.serverId}/`)
            .catch(() => {
              /* swallow */
            });
        }
      },

      clearAll: () => {
        // Local-only clear. The server-side rows are untouched on
        // purpose — clearAll is a "hide everything from this view"
        // gesture, not a destructive delete. If the user wants the
        // rows gone server-side they can mark-all-read or delete
        // individually.
        set({ items: [] });
      },

      unreadCount: () => get().items.filter((it) => it.readAt === null).length,

      hydrate: async () => {
        if (get().isHydrating) return;
        set({ isHydrating: true });
        try {
          const res = await client.get("/auth/notifications/");
          const serverItems: NotificationItem[] = (
            res.data?.results ?? []
          ).map((n: ServerNotification) => fromServer(n));

          // Merge: server items become the source of truth for anything
          // with a serverId; preserve any purely local items (no
          // serverId) that arrived between the request being sent and
          // the response landing.
          set((state) => {
            const localOnly = state.items.filter((it) => !it.serverId);
            const merged = [...serverItems, ...localOnly]
              .sort((a, b) => b.receivedAt - a.receivedAt)
              .slice(0, MAX_ITEMS);
            return {
              items: merged,
              lastHydratedAt: Date.now(),
            };
          });
        } catch {
          // Hydration is best-effort; failure leaves the existing
          // local cache in place. The toast UI keeps working.
        } finally {
          set({ isHydrating: false });
        }
      },
    }),
    {
      name: "eduspace.notifications",
      // Bumped from 1 because we changed the item shape (serverId).
      // zustand/persist will drop the old cache cleanly.
      version: 2,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
