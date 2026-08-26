import { beforeEach, describe, expect, it } from "vitest";
import { useRoomStore } from "../roomStore";

describe("useRoomStore guest access lifecycle", () => {
  beforeEach(() => {
    useRoomStore.getState().clearRoom();
  });

  it("keeps the signed guest credential in room memory and clears it on leave", () => {
    useRoomStore.getState().setRoom({
      token: "livekit-token",
      livekitUrl: "ws://localhost:7880",
      roomCode: "ABC123",
      roomName: "Guest room",
      isHost: false,
      isGuest: true,
      guestIdentity: "guest_123456789abc",
      guestAccessToken: "signed-room-token",
    });

    expect(useRoomStore.getState().guestAccessToken).toBe("signed-room-token");

    useRoomStore.getState().clearRoom();

    expect(useRoomStore.getState().guestAccessToken).toBeNull();
    expect(useRoomStore.getState().guestIdentity).toBeNull();
  });
});
