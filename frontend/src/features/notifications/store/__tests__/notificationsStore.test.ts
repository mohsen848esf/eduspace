import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNotificationsStore } from "../notificationsStore";
import client from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("useNotificationsStore user isolation and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationsStore.getState().clearAll();
    useNotificationsStore.getState().setUserId(null);
  });

  it("adds notifications and computes unread count", () => {
    useNotificationsStore.getState().setUserId(101);
    useNotificationsStore.getState().add("ROOM_INVITE", {
      room_code: "FGPZ6I",
      from: "Mohsen",
    });

    const items = useNotificationsStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("ROOM_INVITE");
    expect(items[0].data.room_code).toBe("FGPZ6I");
    expect(useNotificationsStore.getState().unreadCount()).toBe(1);
  });

  it("clears notifications when user ID changes (preventing cross-account leaks)", () => {
    // User A receives a room invite
    useNotificationsStore.getState().setUserId(1);
    useNotificationsStore.getState().add("ROOM_INVITE", {
      room_code: "FGPZ6I",
      from: "Mohsen",
    });
    expect(useNotificationsStore.getState().items).toHaveLength(1);

    // User B logs in on same browser
    useNotificationsStore.getState().setUserId(2);
    expect(useNotificationsStore.getState().items).toHaveLength(0);
    expect(useNotificationsStore.getState().unreadCount()).toBe(0);
  });

  it("marks notification as read and calls correct /auth/notifications/ endpoint", async () => {
    (client.post as any).mockResolvedValue({ data: { success: true } });

    useNotificationsStore.getState().setUserId(1);
    useNotificationsStore.getState().add(
      "ROOM_INVITE",
      { room_code: "TEST1" },
      { serverId: 55 }
    );

    const id = useNotificationsStore.getState().items[0].id;
    useNotificationsStore.getState().markRead(id);

    expect(useNotificationsStore.getState().items[0].readAt).not.toBeNull();
    expect(client.post).toHaveBeenCalledWith("/auth/notifications/55/read/");
  });

  it("hydrates from /auth/notifications/ endpoint", async () => {
    (client.get as any).mockResolvedValue({
      data: {
        count: 1,
        results: [
          {
            id: 99,
            kind: "RECORDING_PUBLISHED",
            data: { recording_token: "rec-123" },
            created_at: "2026-08-15T12:00:00Z",
            read_at: null,
          },
        ],
      },
    });

    useNotificationsStore.getState().setUserId(1);
    await useNotificationsStore.getState().hydrate();

    expect(client.get).toHaveBeenCalledWith("/auth/notifications/");
    expect(useNotificationsStore.getState().items).toHaveLength(1);
    expect(useNotificationsStore.getState().items[0].serverId).toBe(99);
  });
});
