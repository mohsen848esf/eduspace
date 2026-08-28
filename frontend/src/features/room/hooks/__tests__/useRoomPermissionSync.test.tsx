import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { useRoomPermissionSync } from "../useRoomPermissionSync";
import { useInCallPermissions } from "../useInCallPermissions";
import { useHostControls } from "../useHostControls";
import { useRoomStore } from "../../store/roomStore";
import type { RoomPermissionSnapshot } from "../../schemas/room.schema";
import { applyPermissionSnapshot, grantRoomPermission } from "../../lib/roomPermissions";

const mocks = vi.hoisted(() => ({
  getPermissions: vi.fn(), grantMediaPermission: vi.fn(), grantPresentationPermission: vi.fn(),
  room: {
    on: vi.fn(), off: vi.fn(),
    localParticipant: {
      identity: "student", name: "Student", isCameraEnabled: false,
      isMicrophoneEnabled: false, isScreenShareEnabled: false,
      publishData: vi.fn(), setCameraEnabled: vi.fn(),
      setMicrophoneEnabled: vi.fn(), setScreenShareEnabled: vi.fn(),
    },
  },
}));
vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => mocks.room,
  useLocalParticipant: () => ({ localParticipant: mocks.room.localParticipant }),
}));
vi.mock("../../api/room.api", () => ({ roomApi: {
  getPermissions: mocks.getPermissions, grantMediaPermission: mocks.grantMediaPermission,
  grantPresentationPermission: mocks.grantPresentationPermission,
} }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

let snapshot: RoomPermissionSnapshot;
const listeners = new Map<string, Set<(payload: Uint8Array, sender?: RemoteParticipant) => void>>();
function emit(type: string, data: object = {}, identity = "host") {
  for (const fn of listeners.get(type) ?? []) {
    fn(new TextEncoder().encode(JSON.stringify(data)), { identity } as RemoteParticipant);
  }
}
async function tick(ms = 100) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  listeners.clear();
  mocks.room.on.mockImplementation((event, fn) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  });
  mocks.room.off.mockImplementation((event, fn) => listeners.get(event)?.delete(fn));
  for (const fn of [mocks.room.localParticipant.publishData, mocks.room.localParticipant.setCameraEnabled,
    mocks.room.localParticipant.setMicrophoneEnabled, mocks.room.localParticipant.setScreenShareEnabled]) {
    fn.mockResolvedValue(undefined);
  }
  mocks.room.localParticipant.identity = "student";
  mocks.room.localParticipant.isCameraEnabled = false;
  mocks.room.localParticipant.isScreenShareEnabled = false;
  useRoomStore.getState().clearRoom();
  useRoomStore.getState().setRoom({
    token: "rtc-token", roomCode: "SYNC01", roomName: "Sync", livekitUrl: "wss://test",
    isHost: false, lockScreenShare: true, lockDocumentPresentation: true,
    canShareScreen: false, canUploadPresentation: false,
  });
  snapshot = {
    room_code: "SYNC01", identity: "student", host_identity: "host", co_hosts: [],
    is_host: false, is_co_host: false, lock_screen_share: true, lock_camera: false,
    lock_microphone: false, lock_document_presentation: true,
    can_share_screen: false, can_upload_presentation: false,
    can_use_camera: true, can_use_microphone: true, participants: [],
  };
  mocks.getPermissions.mockImplementation(async () => ({ ...snapshot }));
  mocks.grantMediaPermission.mockImplementation(async (_room, identity, _permission, granted) => ({ participant: identity, granted }));
  mocks.grantPresentationPermission.mockImplementation(async (_room, identity, granted) => ({ participant: identity, granted }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("server-authoritative room permission sync", () => {
  it("applies direct grants under locks without another request or starting capture", async () => {
    renderHook(() => useRoomPermissionSync());
    await tick();
    snapshot.can_share_screen = snapshot.can_upload_presentation = true;
    act(() => emit(RoomEvent.DataReceived, { type: "PERMISSIONS_CHANGED", granted: true }));
    await tick();
    expect(useRoomStore.getState()).toMatchObject({ canShareScreen: true, canUploadPresentation: true, lockScreenShare: true });
    expect(mocks.room.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled();
    expect(mocks.room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(mocks.room.localParticipant.publishData).not.toHaveBeenCalled();
  });

  it("ignores forged grant values and role changes in data packets", async () => {
    renderHook(() => useRoomPermissionSync());
    await tick();
    act(() => emit(RoomEvent.DataReceived, { type: "PERMISSION_RESPONSE", granted: true, permission: "screen_share", identity: "student" }, "attacker"));
    await tick();
    act(() => emit(RoomEvent.DataReceived, { type: "ROLE_CHANGED", identity: "student", role: "co_host" }, "attacker"));
    await tick();
    expect(useRoomStore.getState()).toMatchObject({ canShareScreen: false, isCoHost: false });
  });

  it("refreshes on initial connection when LiveKit identity was not ready at mount", async () => {
    mocks.room.localParticipant.identity = "";
    renderHook(() => useRoomPermissionSync());
    await tick();
    expect(useRoomStore.getState().permissionSnapshot).toBeNull();
    mocks.room.localParticipant.identity = "student";
    snapshot.can_upload_presentation = true;
    act(() => emit(RoomEvent.Connected));
    await tick();
    expect(useRoomStore.getState().canUploadPresentation).toBe(true);
  });

  it("does not re-revoke granted media when an unrelated room setting changes", async () => {
    snapshot.lock_camera = true;
    snapshot.can_use_camera = true;
    mocks.room.localParticipant.isCameraEnabled = true;
    renderHook(() => useRoomPermissionSync());
    await tick();
    act(() => emit(RoomEvent.DataReceived, { type: "ROOM_SETTINGS_CHANGED", settings: { lockCamera: true, lockScreenShare: true } }));
    await tick();
    expect(useRoomStore.getState().canUseCamera).toBe(true);
    expect(mocks.room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    mocks.room.localParticipant.isCameraEnabled = false;
  });

  it("restores grants on reconnect and revokes through fallback reconciliation", async () => {
    renderHook(() => useRoomPermissionSync());
    await tick();
    snapshot.can_share_screen = true;
    act(() => emit(RoomEvent.Reconnected));
    await tick();
    expect(useRoomStore.getState().canShareScreen).toBe(true);
    snapshot.can_share_screen = false;
    mocks.room.localParticipant.isScreenShareEnabled = true;
    await tick(15000);
    expect(useRoomStore.getState().canShareScreen).toBe(false);
    expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(false);
  });

  it("uses signed guest credentials and preserves state on transient failures", async () => {
    useRoomStore.setState({ isGuest: true, guestAccessToken: "signed-guest" });
    renderHook(() => useRoomPermissionSync());
    await tick();
    expect(mocks.getPermissions).toHaveBeenCalledWith("SYNC01", "signed-guest");
    mocks.getPermissions.mockRejectedValueOnce(new Error("offline"));
    await tick(15000);
    expect(useRoomStore.getState().canUseCamera).toBe(true);
    expect(mocks.room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
  });

  it("does not apply a pending response after leaving and removes all listeners", async () => {
    let resolve!: (value: RoomPermissionSnapshot) => void;
    mocks.getPermissions.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => useRoomPermissionSync());
    await tick();
    unmount();
    useRoomStore.getState().clearRoom();
    await act(async () => resolve({ ...snapshot, can_share_screen: true }));
    expect(useRoomStore.getState().permissionSnapshot).toBeNull();
    expect([...listeners.values()].every((set) => set.size === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("coalesces duplicates and fetches again if a grant arrives during an old request", async () => {
    let resolve!: (value: RoomPermissionSnapshot) => void;
    mocks.getPermissions.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderHook(() => useRoomPermissionSync());
    await tick();
    act(() => {
      for (let i = 0; i < 3; i++) emit(RoomEvent.DataReceived, { type: "PERMISSIONS_CHANGED" });
    });
    await act(async () => resolve(snapshot));
    expect(useRoomStore.getState().permissionSnapshot).toBeNull();
    snapshot.can_upload_presentation = true;
    await tick();
    expect(mocks.getPermissions).toHaveBeenCalledTimes(2);
    expect(useRoomStore.getState().canUploadPresentation).toBe(true);
  });

  it("keeps the same store snapshot for an unchanged fallback poll", async () => {
    renderHook(() => useRoomPermissionSync());
    await tick();
    const first = useRoomStore.getState().permissionSnapshot;
    await tick(15000);
    expect(useRoomStore.getState().permissionSnapshot).toBe(first);
  });
});

describe("grant entry points", () => {
  it("member screen-share action calls the real persisted API and publishes invalidation", async () => {
    useRoomStore.setState({ isHost: true });
    const { result } = renderHook(() => useHostControls());
    await act(async () => result.current.grantScreenShare({ identity: "student" } as RemoteParticipant));
    expect(mocks.grantMediaPermission).toHaveBeenCalledWith("SYNC01", "student", "screen_share", true);
    expect(mocks.room.localParticipant.publishData).toHaveBeenCalledTimes(1);
    const payload = mocks.room.localParticipant.publishData.mock.calls[0][0];
    expect(JSON.parse(new TextDecoder().decode(payload))).toMatchObject({ type: "PERMISSIONS_CHANGED", identity: "student" });
  });

  it("does not report a saved grant as failed when realtime delivery fails", async () => {
    mocks.room.localParticipant.publishData.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useHostControls());
    // Same shared function used by presentation menu and request approval.
    expect(result.current).toBeDefined();
    const room = mocks.room as unknown as Parameters<typeof grantRoomPermission>[0];
    const response = await grantRoomPermission(room, "SYNC01", "student", "presentation_upload", true);
    expect(response).toMatchObject({ granted: true, notified: false });
  });

  it("never broadcasts when REST denies the grant", async () => {
    mocks.grantPresentationPermission.mockRejectedValueOnce(new Error("403"));
    const room = mocks.room as unknown as Parameters<typeof grantRoomPermission>[0];
    await expect(grantRoomPermission(room, "SYNC01", "student", "presentation_upload", true)).rejects.toThrow("403");
    expect(mocks.room.localParticipant.publishData).not.toHaveBeenCalled();
  });

  it("request approval uses the same persisted grant path", async () => {
    useRoomStore.setState({ isHost: true });
    const { result } = renderHook(() => useInCallPermissions());
    await act(async () => result.current.approveRequest({
      id: "request", identity: "student", displayName: "Student", permission: "presentation_upload", timestamp: Date.now(),
    }));
    expect(mocks.grantPresentationPermission).toHaveBeenCalledWith("SYNC01", "student", true);
  });

  it("rejects spoofed request identities and does not treat denial as revocation", async () => {
    applyPermissionSnapshot({ ...snapshot, is_host: true, can_upload_presentation: true });
    const { result } = renderHook(() => useInCallPermissions());
    act(() => emit(RoomEvent.DataReceived, { type: "PERMISSION_REQUEST", id: "fake", identity: "victim", permission: "camera" }, "attacker"));
    expect(result.current.requests).toEqual([]);
    act(() => emit(RoomEvent.DataReceived, { type: "PERMISSION_RESPONSE", identity: "student", permission: "presentation_upload", granted: false }));
    expect(useRoomStore.getState().canUploadPresentation).toBe(true);
  });
});
