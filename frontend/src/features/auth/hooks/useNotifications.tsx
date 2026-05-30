import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useNotificationsStore } from "../store/notificationsStore";
import toast from "react-hot-toast";

function formatNotificationDuration(seconds: number | undefined): string {
  if (!seconds || seconds < 1) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function useNotifications() {
  const { t } = useTranslation(["notifications", "recordings"]);
  const { isAuthenticated } = useAuthStore();
  const addToInbox = useNotificationsStore((s) => s.add);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number>(0);
  const isUnmounted = useRef(false);

  const handleNotification = useCallback(
    (notification: any) => {
      // Persist into the inbox first so the user can come back to it
      // even if they miss the toast. The store de-dupes, so this is safe
      // to call on every message including reconnect-replays.
      if (
        notification?.type === "ROOM_INVITE" ||
        notification?.type === "RECORDING_PUBLISHED"
      ) {
        addToInbox(notification.type, notification);
      }

      if (notification.type === "ROOM_INVITE") {
        toast(
          (toastInstance) => (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {t("notifications:roomInvite.title", {
                  from: notification.from,
                })}
              </p>
              <p className="text-xs opacity-70">
                {notification.room_name || notification.room_code}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(toastInstance.id);
                    window.location.href = notification.invite_link;
                  }}
                  className="flex-1 bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-lg"
                >
                  {t("notifications:roomInvite.joinNow")}
                </button>
                <button
                  onClick={() => toast.dismiss(toastInstance.id)}
                  className="px-3 text-xs opacity-60 hover:opacity-100"
                >
                  {t("notifications:roomInvite.dismiss")}
                </button>
              </div>
            </div>
          ),
          {
            duration: 15000,
            style: {
              background: "#1e1e2a",
              color: "#f0f0f8",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "12px",
              padding: "12px",
            },
          },
        );
        return;
      }

      if (notification.type === "RECORDING_PUBLISHED") {
        const watchLink =
          notification.watch_link ||
          (notification.recording_token
            ? `/recordings/${notification.recording_token}`
            : "/recordings");
        toast(
          (toastInstance) => (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {t("recordings:notification.publishedTitle", {
                  from: notification.from,
                })}
              </p>
              <p className="text-xs opacity-70">
                {t("recordings:notification.publishedSubtitle", {
                  roomName:
                    notification.room_name || notification.room_code || "",
                  duration: formatNotificationDuration(
                    notification.duration_seconds,
                  ),
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(toastInstance.id);
                    window.location.href = watchLink;
                  }}
                  className="flex-1 bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-lg"
                >
                  {t("recordings:notification.watch")}
                </button>
                <button
                  onClick={() => toast.dismiss(toastInstance.id)}
                  className="px-3 text-xs opacity-60 hover:opacity-100"
                >
                  {t("recordings:notification.later")}
                </button>
              </div>
            </div>
          ),
          {
            duration: 15000,
            style: {
              background: "#1e1e2a",
              color: "#f0f0f8",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "12px",
              padding: "12px",
            },
          },
        );
        return;
      }
    },
    [t, addToInbox],
  );

  const connect = useCallback(() => {
    if (isUnmounted.current) return;
    if (!isAuthenticated) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log("Connecting to notification WS...");
    const ws = new WebSocket(
      `ws://localhost:8000/ws/notifications/?token=${token}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Notification WS connected ✅");
      reconnectTimeout.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        handleNotification(notification);
      } catch {
        /* swallow malformed payloads */
      }
    };

    ws.onclose = (event) => {
      console.log("Notification WS closed:", event.code);
      if (isUnmounted.current) return;
      if (!isAuthenticated) return;

      const delay = Math.min(
        1000 * Math.pow(2, reconnectTimeout.current),
        30000,
      );
      reconnectTimeout.current += 1;
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isAuthenticated, handleNotification]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    return () => {
      isUnmounted.current = true;
      wsRef.current?.close();
    };
  }, [connect]);
}
