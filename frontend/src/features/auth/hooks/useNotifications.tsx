import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

export function useNotifications() {
  const { t } = useTranslation("notifications");
  const { isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number>(0);
  const isUnmounted = useRef(false);

  const handleNotification = useCallback(
    (notification: any) => {
      if (notification.type === "ROOM_INVITE") {
        toast(
          (toastInstance) => (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {t("roomInvite.title", { from: notification.from })}
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
                  {t("roomInvite.joinNow")}
                </button>
                <button
                  onClick={() => toast.dismiss(toastInstance.id)}
                  className="px-3 text-xs opacity-60 hover:opacity-100"
                >
                  {t("roomInvite.dismiss")}
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
      }
    },
    [t],
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
