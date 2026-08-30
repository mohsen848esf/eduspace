import { beforeEach, describe, expect, it } from "vitest";
import { useActiveRecordingStore } from "../activeRecordingStore";

describe("useActiveRecordingStore", () => {
  beforeEach(() => {
    useActiveRecordingStore.getState().reset();
  });

  it("supports type-safe functional status transitions", () => {
    useActiveRecordingStore.getState().setStatus((current) => ({
      ...current,
      status: "paused",
    }));

    expect(useActiveRecordingStore.getState().status).toEqual({
      status: "paused",
      recording: null,
    });
  });

  it("resets recording status, permission, and navigation tokens", () => {
    const store = useActiveRecordingStore.getState();
    store.setStatus({ status: "recording", recording: null });
    store.setPermission({ can_control: true, is_host: false, grants: [] });
    store.setInFlight("active-token");
    store.setPendingEdit("completed-token");

    useActiveRecordingStore.getState().reset();

    expect(useActiveRecordingStore.getState()).toMatchObject({
      status: { status: "idle", recording: null },
      permission: { can_control: false, is_host: false, grants: null },
      inFlightToken: null,
      pendingEditToken: null,
    });
  });
});
