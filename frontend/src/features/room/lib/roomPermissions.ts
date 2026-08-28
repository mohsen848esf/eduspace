import type { Room } from "livekit-client";
import { roomApi } from "../api/room.api";
import type { RoomPermission, RoomPermissionSnapshot } from "../schemas/room.schema";
import { useRoomStore } from "../store/roomStore";

export const PERMISSIONS_INVALIDATED = "eduspace:permissions-invalidated";

export function applyPermissionSnapshot(snapshot: RoomPermissionSnapshot) {
  // The fallback poll must not rerender every tile when nothing changed.
  if (JSON.stringify(useRoomStore.getState().permissionSnapshot) === JSON.stringify(snapshot)) return;
  useRoomStore.setState({
    permissionSnapshot: snapshot,
    isHost: snapshot.is_host,
    isCoHost: snapshot.is_co_host,
    coHosts: snapshot.co_hosts,
    lockScreenShare: snapshot.lock_screen_share,
    lockMicrophone: snapshot.lock_microphone,
    lockCamera: snapshot.lock_camera,
    lockDocumentPresentation: snapshot.lock_document_presentation,
    canShareScreen: snapshot.can_share_screen,
    canUseMicrophone: snapshot.can_use_microphone,
    canUseCamera: snapshot.can_use_camera,
    canUploadPresentation: snapshot.can_upload_presentation,
  });
}

export function isModeratorIdentity(identity: string | undefined) {
  const snapshot = useRoomStore.getState().permissionSnapshot;
  return Boolean(identity && snapshot && (
    identity === snapshot.host_identity || snapshot.co_hosts.includes(identity)
  ));
}

export function isRoomPermission(value: unknown): value is RoomPermission {
  return value === "screen_share" || value === "microphone" ||
    value === "camera" || value === "presentation_upload";
}

/** A successful REST mutation is authoritative; broadcast failure must not undo it. */
export async function grantRoomPermission(
  room: Room, roomCode: string, identity: string, permission: RoomPermission, granted: boolean,
) {
  const result = permission === "presentation_upload"
    ? await roomApi.grantPresentationPermission(roomCode, identity, granted)
    : await roomApi.grantMediaPermission(roomCode, identity, permission, granted);
  const field = {
    screen_share: "can_share_screen", microphone: "can_use_microphone",
    camera: "can_use_camera", presentation_upload: "can_upload_presentation",
  }[permission];
  const snapshot = useRoomStore.getState().permissionSnapshot;
  if (snapshot?.room_code === roomCode) {
    useRoomStore.setState({ permissionSnapshot: {
      ...snapshot,
      participants: snapshot.participants.map((p) => p.identity === result.participant
        ? { ...p, [field]: result.granted } : p),
    } });
  }
  window.dispatchEvent(new Event(PERMISSIONS_INVALIDATED));
  try {
    await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({
      type: "PERMISSIONS_CHANGED", identity: result.participant, permission,
      granted: result.granted,
    })), { reliable: true });
    return { ...result, notified: true };
  } catch {
    // Recipients also reconcile periodically and on reconnect.
    return { ...result, notified: false };
  }
}
