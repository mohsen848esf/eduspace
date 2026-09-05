import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "../chatStore";
beforeEach(() => useChatStore.setState({ messagesByRoom: {}, readCountByRoom: {} }));
describe("room chat history", () => {
 it("deduplicates replayed messages and keeps rooms isolated", () => {
  const message = { id: "1", from: "guest", fromName: "Guest", message: "hello", timestamp: 1 };
  useChatStore.getState().addMessage("room-a", message);
  useChatStore.getState().addMessage("room-a", message);
  expect(useChatStore.getState().getMessages("room-a")).toEqual([message]);
  expect(useChatStore.getState().getMessages("room-b")).toEqual([]);
 });
 it("updates streamed message content without duplicating the message", () => {
  const message = { id: "1", from: "guest", fromName: "Guest", message: "hel", timestamp: 1 };
  useChatStore.getState().addMessage("room-a", message);
  useChatStore.getState().addMessage("room-a", { ...message, message: "hello" });
  expect(useChatStore.getState().getMessages("room-a")).toEqual([{ ...message, message: "hello" }]);
 });
 it("does not publish a store update when the room is already read", () => {
  const listener = vi.fn();
  const unsubscribe = useChatStore.subscribe(listener);

  useChatStore.getState().markRead("room-a", 0);
  expect(listener).not.toHaveBeenCalled();

  useChatStore.getState().markRead("room-a", 2);
  expect(listener).toHaveBeenCalledTimes(1);
  useChatStore.getState().markRead("room-a", 2);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
 });
 it("clears read state with the ended room", () => {
  useChatStore.getState().markRead("room-a", 5);
  useChatStore.getState().clearRoom("room-a");
  expect(useChatStore.getState().readCountByRoom["room-a"]).toBeUndefined();
 });
});
