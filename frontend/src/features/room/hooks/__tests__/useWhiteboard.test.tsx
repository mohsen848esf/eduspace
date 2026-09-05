import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWhiteboard } from "../useWhiteboard";
import { useRoomStore } from "../../store/roomStore";
const mock = vi.hoisted(() => ({ sendText: vi.fn(), publishData: vi.fn(), handlers: new Map<string, (...args: unknown[]) => unknown>(), events: new Map<string, (...args: unknown[]) => unknown>() }));
vi.mock("@livekit/components-react", () => ({ useRoomContext: () => room, useLocalParticipant: () => ({ localParticipant: room.localParticipant }) }));
const room = {
 state: "connected", localParticipant: { identity: "host", sendText: mock.sendText, publishData: mock.publishData },
 registerTextStreamHandler: (topic: string, fn: (...args: unknown[]) => unknown) => mock.handlers.set(topic, fn),
 unregisterTextStreamHandler: (topic: string) => mock.handlers.delete(topic),
 on: (event: string, fn: (...args: unknown[]) => unknown) => mock.events.set(event, fn),
 off: (event: string) => mock.events.delete(event),
};
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); mock.handlers.clear(); mock.events.clear(); mock.sendText.mockResolvedValue({}); useRoomStore.setState({ isHost: true, permissionSnapshot: { host_identity: "host" } as never }); });
describe("whiteboard session synchronization", () => {
 it("retains image and sticky state while minimized and replays it to a remounted canvas", async () => {
   const { result } = renderHook(() => useWhiteboard());
   await act(async () => { await result.current.launchWhiteboard(); });
   const element = { id: "image-1", type: "image", url: "data:image/png;base64," + "a".repeat(32000) };
   await act(async () => { await result.current.broadcastWhiteboardEvent("WHITEBOARD_OP", { type: "CREATE", element }); });
   act(() => result.current.minimizeWhiteboard());
   const listener = vi.fn();
   act(() => { result.current.subscribeWhiteboardEvents(listener); result.current.restoreWhiteboard(); });
   expect(listener).toHaveBeenCalledWith("WHITEBOARD_SYNC", { elements: { "image-1": element } }, "host");
   expect(mock.sendText.mock.calls.some(([body]) => body.length > 32000)).toBe(true);
   expect(mock.publishData).not.toHaveBeenCalled();
 });
 it("does not close locally if the shared close could not be delivered", async () => {
   const { result } = renderHook(() => useWhiteboard());
   await act(async () => { await result.current.launchWhiteboard(); });
   mock.sendText.mockRejectedValueOnce(new Error("offline"));
   await act(async () => { await result.current.endWhiteboard(); });
   expect(result.current.whiteboard.isActive).toBe(true);
   await act(async () => { await result.current.endWhiteboard(); });
   expect(result.current.whiteboard.isActive).toBe(false);
 });
 it("closes a remote active board as soon as host end arrives", async () => {
   useRoomStore.setState({ isHost: false });
   const { result } = renderHook(() => useWhiteboard());
   const receive = (type: string, payload = {}) => mock.handlers.get("eduspace.whiteboard.v2")?.({ readAll: async () => JSON.stringify({ type, payload }) }, { identity: "host" });
   await act(async () => { receive("WHITEBOARD_LAUNCH"); });
   await waitFor(() => expect(result.current.whiteboard.isActive).toBe(true));
   act(() => result.current.minimizeWhiteboard());
   await act(async () => { receive("WHITEBOARD_END"); });
   await waitFor(() => expect(result.current.whiteboard.isActive).toBe(false));
 });
});
