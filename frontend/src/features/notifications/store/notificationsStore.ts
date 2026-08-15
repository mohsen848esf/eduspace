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

interface NotificationsState {
  items: NotificationItem[];
  isHydrating: boolean;
  lastHydratedAt: number;

  add: (
    kind: NotificationKind,
    data: Record<string, unknown>,
    opts?: { serverId?: number; createdAt?: string }
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
  hydrate: () => Promise<void>;
}

const MAX_ITEMS = 50;

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
      items: [],
      isHydrating: false,
      lastHydratedAt: 0,

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
          client.patch(`/notifications/read/`, { id: item.serverId }).catch(() => {});
        }
      },

      markAllRead: () => {
        const now = Date.now();
        const ids = get()
          .items.filter((it) => it.readAt === null && it.serverId)
          .map((it) => it.serverId!);
        set((state) => ({
          items: state.items.map((it) =>
            it.readAt === null ? { ...it, readAt: now } : it
          ),
        }));
        if (ids.length > 0) {
          client.patch(`/notifications/read/`, { all: true }).catch(() => {});
        }
      },

      remove: (id) => {
        const item = get().items.find((it) => it.id === id);
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        }));
        if (item?.serverId) {
          client.delete(`/notifications/${item.serverId}/`).catch(() => {});
        }
      },

      clearAll: () => {
        set({ items: [] });
      },

      unreadCount: () => get().items.filter((it) => it.readAt === null).length,

      hydrate: async () => {
        if (get().isHydrating) return;
        set({ isHydrating: true });
        try {
          const res = await client.get("/notifications/");
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
      version: 2,
      partialize: (state) => ({ items: state.items }),
    }
  )
);
