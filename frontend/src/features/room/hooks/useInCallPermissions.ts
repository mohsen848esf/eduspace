import { useState, useEffect, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { roomApi } from "../api/room.api";
import toast from "react-hot-toast";
import type { PermissionRequest } from "../components/InCallPermissionNotification";

export function useInCallPermissions() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { isHost, isCoHost, roomCode, setMediaPermissions } = useRoomStore();
  const canModerate = isHost || isCoHost;

  const [requests, setRequests] = useState<PermissionRequest[]>([]);

  // Send a permission request to the room host & co-hosts
  const requestPermission = useCallback(
    async (permission: "screen_share" | "microphone" | "camera" | "presentation_upload") => {
      if (!room || !localParticipant) return;
      const reqPayload = {
        type: "PERMISSION_REQUEST",
        id: `${localParticipant.identity}-${permission}-${Date.now()}`,
        identity: localParticipant.identity,
        displayName: localParticipant.name || localParticipant.identity,
        permission,
        timestamp: Date.now(),
      };

      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(reqPayload));
        await room.localParticipant.publishData(data, { reliable: true });

        let permName = "دسترسی";
        if (permission === "screen_share") permName = "اشتراک صفحه";
        else if (permission === "microphone") permName = "استفاده از میکروفون";
        else if (permission === "camera") permName = "استفاده از دوربین";
        else if (permission === "presentation_upload") permName = "آپلود و ارائه فایل";

        toast(`درخواست ${permName} برای برگزارکننده ارسال شد.`, {
          icon: "⏳",
        });
      } catch (err) {
        console.error("Failed to send permission request", err);
        toast.error("خطا در ارسال درخواست مجوز.");
      }
    },
    [room, localParticipant],
  );

  // Host/Co-Host approves a request
  const approveRequest = useCallback(
    async (req: PermissionRequest) => {
      if (!roomCode || !canModerate) return;
      try {
        if (req.permission === "presentation_upload") {
          await roomApi.grantPresentationPermission(roomCode, req.identity, true);
        } else {
          await roomApi.grantMediaPermission(
            roomCode,
            req.identity,
            req.permission,
            true,
          );
        }

        // Broadcast permission granted over data channel
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "PERMISSION_RESPONSE",
            identity: req.identity,
            permission: req.permission,
            granted: true,
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });

        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        toast.success(`دسترسی برای ${req.displayName} تایید شد.`);
      } catch (err) {
        console.error("Failed to grant permission", err);
        toast.error("خطا در اعمال مجوز.");
      }
    },
    [roomCode, canModerate, room],
  );

  // Host/Co-Host denies a request
  const denyRequest = useCallback(
    async (req: PermissionRequest) => {
      if (!roomCode || !canModerate) return;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "PERMISSION_RESPONSE",
            identity: req.identity,
            permission: req.permission,
            granted: false,
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });

        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        toast(`درخواست ${req.displayName} رد شد.`, { icon: "ℹ️" });
      } catch (err) {
        console.error("Failed to deny permission request", err);
      }
    },
    [roomCode, canModerate, room],
  );

  // Listen to incoming data messages
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        // When a participant requests permission -> show banner for host/co-host
        if (data.type === "PERMISSION_REQUEST" && canModerate) {
          setRequests((prev) => {
            if (prev.some((r) => r.id === data.id)) return prev;
            return [
              ...prev,
              {
                id: data.id,
                identity: data.identity,
                displayName: data.displayName,
                permission: data.permission,
                timestamp: data.timestamp || Date.now(),
              },
            ];
          });
        }

        // When host/co-host responds to a request
        if (data.type === "PERMISSION_RESPONSE") {
          if (data.identity === localParticipant?.identity) {
            const { permission, granted } = data;
            let permName = "دسترسی";
            if (permission === "screen_share") {
              permName = "اشتراک صفحه";
              setMediaPermissions({ canShareScreen: granted });
            } else if (permission === "microphone") {
              permName = "استفاده از میکروفون";
              setMediaPermissions({ canUseMicrophone: granted });
              // KEY FIX: actually enable the mic track so user doesn't have to click again
              if (granted && localParticipant) {
                localParticipant.setMicrophoneEnabled(true).catch(console.error);
              }
            } else if (permission === "camera") {
              permName = "استفاده از وب‌کم";
              setMediaPermissions({ canUseCamera: granted });
              // KEY FIX: actually enable the camera track
              if (granted && localParticipant) {
                localParticipant.setCameraEnabled(true).catch(console.error);
              }
            } else if (permission === "presentation_upload") {
              permName = "آپلود و ارائه فایل";
              setMediaPermissions({ canUploadPresentation: granted });
            }

            if (granted) {
              toast.success(`مجوز ${permName} توسط برگزارکننده صادر شد.`);
            } else {
              toast.error(`درخواست مجوز ${permName} توسط برگزارکننده رد شد.`);
            }
          }
        }
      } catch {
        /* ignore invalid data packets */
      }
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room, canModerate, localParticipant, setMediaPermissions]);

  // Auto-expire requests older than 25 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRequests((prev) => prev.filter((r) => now - r.timestamp < 25000));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return {
    requests,
    requestPermission,
    approveRequest,
    denyRequest,
  };
}
