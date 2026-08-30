import { useState, useEffect, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { type RemoteParticipant } from "livekit-client";
import { useRoomStore } from "../store/roomStore";
import { roomApi } from "../api/room.api";
import { grantRoomPermission, isModeratorIdentity, isRoomPermission } from "../lib/roomPermissions";
import toast from "react-hot-toast";
import type { PermissionRequest } from "../components/InCallPermissionNotification";
import type { RoomPermission } from "../schemas/room.schema";

const permissionNames: Record<RoomPermission, string> = {
  screen_share: "اشتراک صفحه", microphone: "استفاده از میکروفون",
  camera: "استفاده از دوربین", presentation_upload: "آپلود و ارائه فایل",
};

export function useInCallPermissions() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const isHost = useRoomStore((s) => s.isHost);
  const isCoHost = useRoomStore((s) => s.isCoHost);
  const roomCode = useRoomStore((s) => s.roomCode);
  const canModerate = isHost || isCoHost;
  const [requests, setRequests] = useState<PermissionRequest[]>([]);

  const requestPermission = useCallback(async (permission: RoomPermission) => {
    if (!room || !localParticipant) return;
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({
        type: "PERMISSION_REQUEST",
        id: `${localParticipant.identity}-${permission}-${Date.now()}`,
        identity: localParticipant.identity,
        displayName: localParticipant.name || localParticipant.identity,
        permission, timestamp: Date.now(),
      })), { reliable: true });
      toast(`درخواست ${permissionNames[permission]} برای برگزارکننده ارسال شد.`, { icon: "⏳" });
    } catch {
      toast.error("خطا در ارسال درخواست مجوز.");
    }
  }, [room, localParticipant]);

  const approveRequest = useCallback(async (req: PermissionRequest) => {
    if (!roomCode || !canModerate) return;
    try {
      await grantRoomPermission(room, roomCode, req.identity, req.permission, true);
      setRequests((prev) => prev.filter((r) => r.identity !== req.identity || r.permission !== req.permission));
      toast.success(`دسترسی برای ${req.displayName} تایید شد.`);
      // Response is only UX feedback; recipients fetch server authority independently.
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({
        type: "PERMISSION_RESPONSE", identity: req.identity,
        permission: req.permission, granted: true,
      })), { reliable: true }).catch(() => undefined);
    } catch {
      toast.error("خطا در اعمال مجوز.");
    }
  }, [roomCode, canModerate, room]);

  const denyRequest = useCallback(async (req: PermissionRequest) => {
    if (!roomCode || !canModerate) return;
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({
        type: "PERMISSION_RESPONSE", identity: req.identity,
        permission: req.permission, granted: false,
      })), { reliable: true });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast(`درخواست ${req.displayName} رد شد.`, { icon: "ℹ️" });
    } catch { toast.error("خطا در ارسال پاسخ درخواست."); }
  }, [roomCode, canModerate, room]);

  useEffect(() => {
    let disposed = false;
    const handleData = async (payload: Uint8Array, sender?: RemoteParticipant) => {
      try {
        const data: Record<string, unknown> = JSON.parse(new TextDecoder().decode(payload));
        if (!isRoomPermission(data.permission)) return;
        const permission = data.permission;
        if (data.type === "PERMISSION_REQUEST" && canModerate) {
          if (!sender || data.identity !== sender.identity || typeof data.id !== "string") return;
          const id = data.id;
          setRequests((prev) => prev.some((r) => r.identity === sender.identity && r.permission === permission)
            ? prev : [...prev, {
              id, identity: sender.identity,
              displayName: sender.name || sender.identity,
              permission, timestamp: Date.now(),
            }]);
        }
        if (!isModeratorIdentity(sender?.identity)) return;
        if (data.type === "PERMISSIONS_CHANGED" || data.type === "PERMISSION_RESPONSE") {
          setRequests((prev) => prev.filter((r) => r.identity !== data.identity || r.permission !== permission));
        }
        if (data.type !== "PERMISSION_RESPONSE" || data.identity !== localParticipant.identity ||
            typeof data.granted !== "boolean") return;
        if (!data.granted) {
          // Denying a request is not revoking an existing grant.
          toast.error(`درخواست مجوز ${permissionNames[permission]} رد شد.`);
          return;
        }
        const session = useRoomStore.getState();
        if (!roomCode) return;
        const snapshot = await roomApi.getPermissions(roomCode, session.isGuest ? session.guestAccessToken : null);
        if (disposed || useRoomStore.getState().token !== session.token ||
            snapshot.identity !== localParticipant.identity || snapshot.room_code !== roomCode) return;
        const allowed = {
          screen_share: snapshot.can_share_screen, microphone: snapshot.can_use_microphone,
          camera: snapshot.can_use_camera, presentation_upload: snapshot.can_upload_presentation,
        }[permission];
        if (!allowed) return;
        toast.success(`مجوز ${permissionNames[permission]} توسط برگزارکننده صادر شد.`);
        // Preserve explicit request-approval behavior; direct grants never start capture.
        if (permission === "microphone") void localParticipant.setMicrophoneEnabled(true).catch(console.error);
        if (permission === "camera") void localParticipant.setCameraEnabled(true).catch(console.error);
      } catch { /* invalid packet or unavailable authority */ }
    };
    room.on("dataReceived", handleData);
    return () => { disposed = true; room.off("dataReceived", handleData); };
  }, [room, roomCode, canModerate, localParticipant]);

  useEffect(() => {
    const timer = setInterval(() => setRequests((prev) =>
      prev.filter((r) => Date.now() - r.timestamp < 25000)), 5000);
    return () => clearInterval(timer);
  }, []);
  return { requests, requestPermission, approveRequest, denyRequest };
}
