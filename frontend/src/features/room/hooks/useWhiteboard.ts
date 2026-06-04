import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import toast from "react-hot-toast";

export interface WhiteboardState {
  isActive: boolean;
  hostIdentity: string | null;
  isDrawingAllowed: boolean;
}

const WHITEBOARD_MESSAGES = {
  WHITEBOARD_LAUNCH: "WHITEBOARD_LAUNCH",
  WHITEBOARD_END: "WHITEBOARD_END",
  WHITEBOARD_RELAY: "WHITEBOARD_RELAY",
  WHITEBOARD_REQUEST_STATE: "WHITEBOARD_REQUEST_STATE",
  WHITEBOARD_SYNC: "WHITEBOARD_SYNC",
} as const;

export function useWhiteboard() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { isHost } = useRoomStore();

  const [whiteboard, setWhiteboard] = useState<WhiteboardState>({
    isActive: false,
    hostIdentity: null,
    isDrawingAllowed: true, // Default to true so participants can collaborate
  });

  const whiteboardRef = useRef(whiteboard);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    whiteboardRef.current = whiteboard;
    isHostRef.current = isHost;
  });

  const sendMessage = useCallback(
    async (type: string, payload: unknown, destinations?: string[]) => {
      if (!room || room.state !== "connected") return;
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type, payload }));
      await room.localParticipant.publishData(data, {
        reliable: true,
        destinationIdentities: destinations,
      });
    },
    [room],
  );

  // Send unreliable messages (like cursor updates)
  const sendUnreliableMessage = useCallback(
    async (type: string, payload: unknown) => {
      if (!room || room.state !== "connected") return;
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type, payload }));
      await room.localParticipant.publishData(data, {
        reliable: false,
      });
    },
    [room],
  );

  const launchWhiteboard = useCallback(async () => {
    if (!isHost) return;

    setWhiteboard({
      isActive: true,
      hostIdentity: localParticipant.identity,
      isDrawingAllowed: true,
    });

    await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_LAUNCH, {
      hostIdentity: localParticipant.identity,
    });

    toast.success("Whiteboard launched", { icon: "✏️" });
  }, [isHost, localParticipant, sendMessage]);

  const endWhiteboard = useCallback(async () => {
    if (!isHost) return;

    setWhiteboard({
      isActive: false,
      hostIdentity: null,
      isDrawingAllowed: true,
    });

    await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_END, {});
    toast("Whiteboard ended", { icon: "✏️" });
  }, [isHost, sendMessage]);

  const toggleDrawingPermission = useCallback(
    async (allowed: boolean) => {
      if (!isHost) return;

      setWhiteboard((prev) => ({
        ...prev,
        isDrawingAllowed: allowed,
      }));

      await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_RELAY, {
        type: "WHITEBOARD_TOGGLE_DRAWING",
        payload: { allowed },
      });

      toast(allowed ? "Participants allowed to draw" : "Drawing restricted to host", {
        icon: "✏️",
      });
    },
    [isHost, sendMessage],
  );

  const listenersRef = useRef<
    Set<(type: string, payload: any, fromIdentity?: string) => void>
  >(new Set());

  const subscribeWhiteboardEvents = useCallback(
    (fn: (type: string, payload: any, fromIdentity?: string) => void) => {
      listenersRef.current.add(fn);
      return () => {
        listenersRef.current.delete(fn);
      };
    },
    [],
  );

  const broadcastWhiteboardEvent = useCallback(
    async (type: string, payload: any, reliable = true) => {
      // Local fan-out first
      listenersRef.current.forEach((fn) => {
        try {
          fn(type, payload, localParticipant.identity);
        } catch (e) {
          console.warn("whiteboard listener threw", e);
        }
      });

      // Local state updates if host clears
      if (type === "WHITEBOARD_CLEAR") {
        // Handled by canvas component listener
      }

      if (reliable) {
        await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_RELAY, { type, payload });
      } else {
        await sendUnreliableMessage(WHITEBOARD_MESSAGES.WHITEBOARD_RELAY, { type, payload });
      }
    },
    [localParticipant.identity, sendMessage, sendUnreliableMessage],
  );

  const handleDataMessage = useCallback(
    (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const { type, payload: data } = JSON.parse(decoder.decode(payload));
        const identity = participant?.identity || data.identity;

        switch (type) {
          case WHITEBOARD_MESSAGES.WHITEBOARD_LAUNCH:
            setWhiteboard({
              isActive: true,
              hostIdentity: data.hostIdentity,
              isDrawingAllowed: true,
            });
            toast("Whiteboard started by host", { icon: "✏️" });
            break;

          case WHITEBOARD_MESSAGES.WHITEBOARD_END:
            setWhiteboard({
              isActive: false,
              hostIdentity: null,
              isDrawingAllowed: true,
            });
            toast("Whiteboard closed by host", { icon: "✏️" });
            break;

          case WHITEBOARD_MESSAGES.WHITEBOARD_RELAY: {
            const innerType = data?.type;
            const innerPayload = data?.payload;

            if (innerType === "WHITEBOARD_TOGGLE_DRAWING") {
              setWhiteboard((prev) => ({
                ...prev,
                isDrawingAllowed: Boolean(innerPayload?.allowed),
              }));
              toast(
                innerPayload?.allowed
                  ? "You are allowed to draw now"
                  : "Drawing is locked by host",
                { icon: "✏️" }
              );
            }

            listenersRef.current.forEach((fn) => {
              try {
                fn(innerType, innerPayload, identity);
              } catch (e) {
                console.warn("whiteboard listener threw", e);
              }
            });
            break;
          }

          case WHITEBOARD_MESSAGES.WHITEBOARD_REQUEST_STATE: {
            const currentWB = whiteboardRef.current;
            // Only the host responds to state sync request
            if (isHostRef.current && currentWB.isActive) {
              // The canvas component itself tracks the drawing history (paths).
              // It will listen for request events, draw them, and trigger sync.
              // To handle this, we propagate request event to local listeners.
              listenersRef.current.forEach((fn) => {
                try {
                  fn("WHITEBOARD_REQUEST_STATE", {}, identity);
                } catch (e) {
                  console.warn("whiteboard listener threw", e);
                }
              });
            }
            break;
          }

          case WHITEBOARD_MESSAGES.WHITEBOARD_SYNC: {
            // Late joiners receive the sync package
            setWhiteboard({
              isActive: true,
              hostIdentity: data.hostIdentity,
              isDrawingAllowed: data.isDrawingAllowed,
            });

            listenersRef.current.forEach((fn) => {
              try {
                fn("WHITEBOARD_SYNC", data.paths, identity);
              } catch (e) {
                console.warn("whiteboard listener threw", e);
              }
            });
            break;
          }
        }
      } catch (e) {
        /* ignore parsing errors */
      }
    },
    [],
  );

  // Sync state request on mount if whiteboard is active
  const requestSyncState = useCallback(async () => {
    if (isHost) return;
    try {
      await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_REQUEST_STATE, {});
    } catch (e) {
      console.warn("Failed to request whiteboard state", e);
    }
  }, [isHost, sendMessage]);

  return {
    whiteboard,
    launchWhiteboard,
    endWhiteboard,
    toggleDrawingPermission,
    broadcastWhiteboardEvent,
    subscribeWhiteboardEvents,
    handleDataMessage,
    requestSyncState,
  };
}
