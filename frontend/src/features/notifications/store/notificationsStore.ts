import { create } from "zustand";
import { persist } from "zustand/middleware";
import client from "@/lib/api/client";

export type NotificationKind =
  | "ROOM_INVITE"
  | "RECORDING_PUBLISHED"
  | "RECORDING_PERMISSION_GRANTED"
  | "RECORDING_PERMISSION_REVOKED"
  | "ASSESSMENT_GRADED"
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "SESSION_STARTED"
  | "IN_APP";

export interface NotificationItem {
  id: string;
  serverId?: number;
  kind: NotificationKind;
  data: Record<string, unknown>;
  receivedAt: number;
  readAt: number | null;
}

export type InboxCategory =
  | "all"
  | "unread"
  | "read"
  | "rooms"
  | "academic"
  | "recordings"
  | "financial"
  | "system";

interface NotificationsState {
  userId: number | null;
  items: NotificationItem[];
  isHydrating: boolean;
  lastHydratedAt: number;

  setUserId: (userId: number | null) => void;
  add: (
    kind: NotificationKind,
    data: Record<string, unknown>,
    opts?: { serverId?: number; createdAt?: string }
  ) => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markReadBatch: (ids: string[]) => void;
  markUnreadBatch: (ids: string[]) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  deleteBatch: (ids: string[]) => void;
  clearAll: () => void;
  unreadCount: () => number;
  hydrate: () => Promise<void>;
}

const MAX_ITEMS = 100;

function makeLocalId(kind: NotificationKind, data: Record<string, unknown>): string {
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
  kind?: NotificationKind;
  channel?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
  created_at: string;
  delivered_at?: string | null;
  read_at: string | null;
}

function fromServer(n: ServerNotification): NotificationItem {
  if (n.channel) {
    return {
      id: `srv:${n.id}`,
      serverId: n.id,
      kind: "IN_APP",
      data: {
        title: n.title,
        message: n.message,
        channel: n.channel,
      },
      receivedAt: Date.parse(n.created_at) || Date.now(),
      readAt: n.read_at ? Date.parse(n.read_at) : null,
    };
  }
  return {
    id: `srv:${n.id}`,
    serverId: n.id,
    kind: n.kind || "IN_APP",
    data: n.data ?? {},
    receivedAt: Date.parse(n.created_at) || Date.now(),
    readAt: n.read_at ? Date.parse(n.read_at) : null,
  };
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      userId: null,
      items: [],
      isHydrating: false,
      lastHydratedAt: 0,

      setUserId: (userId: number | null) => {
        const currentUserId = get().userId;
        if (currentUserId !== userId) {
          set({
            userId,
            items: [],
            lastHydratedAt: 0,
          });
        }
      },

      add: (kind, data, opts) =>
        set((state) => {
          if (opts?.serverId !== undefined) {
            const dupe = state.items.find((it) => it.serverId === opts.serverId);
            if (dupe) return state;
          }

          const now = Date.now();
          if (opts?.serverId === undefined) {
            const recent = state.items.find(
              (it) =>
                !it.serverId &&
                it.kind === kind &&
                now - it.receivedAt < 5_000 &&
                (it.data.room_code ?? null) === (data.room_code ?? null) &&
                (it.data.recording_token ?? null) === (data.recording_token ?? null)
            );
            if (recent) return state;
          }

          const receivedAt = opts?.createdAt ? Date.parse(opts.createdAt) || now : now;
          const next: NotificationItem = {
            id: opts?.serverId !== undefined ? `srv:${opts.serverId}` : makeLocalId(kind, data),
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
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id && it.readAt === null ? { ...it, readAt: Date.now() } : it
          ),
        }));
        if (item?.serverId) {
          client.post(`/auth/notifications/${item.serverId}/read/`).catch(() => {});
        }
      },

      markUnread: (id) => {
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, readAt: null } : it
          ),
        }));
      },

      markReadBatch: (ids) => {
        const idSet = new Set(ids);
        const now = Date.now();
        const serverIds: number[] = [];

        set((state) => ({
          items: state.items.map((it) => {
            if (idSet.has(it.id)) {
              if (it.serverId) serverIds.push(it.serverId);
              return { ...it, readAt: it.readAt ?? now };
            }
            return it;
          }),
        }));

        serverIds.forEach((sid) => {
          client.post(`/auth/notifications/${sid}/read/`).catch(() => {});
        });
      },

      markUnreadBatch: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          items: state.items.map((it) =>
            idSet.has(it.id) ? { ...it, readAt: null } : it
          ),
        }));
      },

      markAllRead: () => {
        const now = Date.now();
        set((state) => ({
          items: state.items.map((it) =>
            it.readAt === null ? { ...it, readAt: now } : it
          ),
        }));
        client.post(`/auth/notifications/read-all/`).catch(() => {});
      },

      remove: (id) => {
        const item = get().items.find((it) => it.id === id);
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        }));
        if (item?.serverId) {
          client.delete(`/auth/notifications/${item.serverId}/`).catch(() => {});
        }
      },

      deleteBatch: (ids) => {
        const idSet = new Set(ids);
        const serverIds: number[] = [];

        set((state) => ({
          items: state.items.filter((it) => {
            if (idSet.has(it.id)) {
              if (it.serverId) serverIds.push(it.serverId);
              return false;
            }
            return true;
          }),
        }));

        serverIds.forEach((sid) => {
          client.delete(`/auth/notifications/${sid}/`).catch(() => {});
        });
      },

      clearAll: () => {
        set({ items: [], lastHydratedAt: 0 });
      },

      unreadCount: () => get().items.filter((it) => it.readAt === null).length,

      hydrate: async () => {
        if (get().isHydrating) return;
        set({ isHydrating: true });
        try {
          const res = await client.get("/auth/notifications/");
          const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
          const serverItems: NotificationItem[] = data.map((n: ServerNotification) => fromServer(n));

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
          // Hydration is best-effort
        } finally {
          set({ isHydrating: false });
        }
      },
    }),
    {
      name: "eduspace.notifications",
      version: 3,
      partialize: (state) => ({ userId: state.userId, items: state.items }),
    }
  )
);
