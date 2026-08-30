import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import toast from "react-hot-toast";
import type { Participant, RemoteParticipant } from "livekit-client";
import type { WhiteboardEventListener } from "../types/whiteboard";

export interface WhiteboardState {
  isActive: boolean;
  isMinimized: boolean;
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
    isMinimized: false,
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
      isMinimized: false,
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
      isMinimized: false,
      hostIdentity: null,
      isDrawingAllowed: true,
    });

    await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_END, {});
    toast("Whiteboard ended", { icon: "✏️" });
  }, [isHost, sendMessage]);

  const minimizeWhiteboard = useCallback(() => {
    setWhiteboard((prev) => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const restoreWhiteboard = useCallback(() => {
    setWhiteboard((prev) => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

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

  const listenersRef = useRef<Set<WhiteboardEventListener>>(new Set());

  const subscribeWhiteboardEvents = useCallback(
    (fn: WhiteboardEventListener) => {
      listenersRef.current.add(fn);
      return () => {
        listenersRef.current.delete(fn);
      };
    },
    [],
  );

  const broadcastWhiteboardEvent = useCallback(
    async (type: string, payload: unknown, reliable = true) => {
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
    (payload: Uint8Array, participant?: Participant) => {
      try {
        const decoder = new TextDecoder();
        const { type, payload: data } = JSON.parse(decoder.decode(payload));
        const identity = participant?.identity || data.identity;

        switch (type) {
          case WHITEBOARD_MESSAGES.WHITEBOARD_LAUNCH:
            setWhiteboard((prev) => {
              if (!prev.isActive) {
                toast("Whiteboard started by host", { id: "wb-launch-toast", icon: "✏️" });
              }
              return {
                isActive: true,
                isMinimized: false,
                hostIdentity: data.hostIdentity,
                isDrawingAllowed: data.isDrawingAllowed ?? true,
              };
            });
            break;

          case WHITEBOARD_MESSAGES.WHITEBOARD_END:
            setWhiteboard((prev) => {
              if (prev.isActive) {
                toast("Whiteboard closed by host", { id: "wb-end-toast", icon: "✏️" });
              }
              return {
                isActive: false,
                isMinimized: false,
                hostIdentity: null,
                isDrawingAllowed: true,
              };
            });
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
                { id: "wb-draw-permission", icon: "✏️" }
              );
            }

            if (innerType === "WHITEBOARD_SYNC") {
              setWhiteboard((prev) => {
                if (!prev.isActive) {
                  toast("Whiteboard started by host", { id: "wb-launch-toast", icon: "✏️" });
                }
                return {
                  ...prev,
                  isActive: true,
                  hostIdentity: innerPayload?.hostIdentity || identity,
                  isDrawingAllowed: innerPayload?.isDrawingAllowed ?? true,
                };
              });
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
              // Proactively send LAUNCH message to the requesting participant
              sendMessage(
                WHITEBOARD_MESSAGES.WHITEBOARD_LAUNCH,
                {
                  hostIdentity: localParticipant.identity,
                  isDrawingAllowed: currentWB.isDrawingAllowed,
                },
                identity ? [identity] : undefined,
              ).catch(() => undefined);

              // The canvas component itself tracks the drawing history (paths).
              // It will listen for request events, draw them, and trigger sync.
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
            setWhiteboard((prev) => {
              if (!prev.isActive) {
                toast("Whiteboard started by host", { id: "wb-launch-toast", icon: "✏️" });
              }
              return {
                ...prev,
                isActive: true,
                hostIdentity: data?.hostIdentity || identity,
                isDrawingAllowed: data?.isDrawingAllowed ?? true,
              };
            });

            listenersRef.current.forEach((fn) => {
              try {
                fn("WHITEBOARD_SYNC", data, identity);
              } catch (e) {
                console.warn("whiteboard listener threw", e);
              }
            });
            break;
          }
        }
      } catch {
        /* ignore parsing errors */
      }
    },
    [localParticipant.identity, sendMessage],
  );

  // 1. Proactive push to new participants when host has an active whiteboard
  useEffect(() => {
    if (!room) return;

    const onParticipantConnected = (remotePart: RemoteParticipant) => {
      if (isHostRef.current && whiteboardRef.current.isActive) {
        sendMessage(
          WHITEBOARD_MESSAGES.WHITEBOARD_LAUNCH,
          {
            hostIdentity: localParticipant.identity,
            isDrawingAllowed: whiteboardRef.current.isDrawingAllowed,
          },
          remotePart?.identity ? [remotePart.identity] : undefined,
        ).catch(() => undefined);

        listenersRef.current.forEach((fn) => {
          try {
            fn("WHITEBOARD_REQUEST_STATE", {}, remotePart?.identity);
          } catch (e) {
            console.warn("whiteboard listener threw", e);
          }
        });
      }
    };

    room.on("participantConnected", onParticipantConnected);
    return () => {
      room.off("participantConnected", onParticipantConnected);
    };
  }, [room, sendMessage, localParticipant.identity]);

  // 2. Late joiner automatic state request on connection
  useEffect(() => {
    if (!room || isHost) return;

    const requestSync = async () => {
      // Delay slightly to ensure host's listeners are fully wired
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try {
        await sendMessage(WHITEBOARD_MESSAGES.WHITEBOARD_REQUEST_STATE, {});
      } catch (e) {
        console.warn("failed to send WHITEBOARD_REQUEST_STATE", e);
      }
    };

    if (room.state === "connected") {
      requestSync();
    }

    const onConnected = () => {
      requestSync();
    };

    room.on("connected", onConnected);
    return () => {
      room.off("connected", onConnected);
    };
  }, [room, isHost, sendMessage]);

  // Sync state request manually
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
    minimizeWhiteboard,
    restoreWhiteboard,
    toggleDrawingPermission,
    broadcastWhiteboardEvent,
    subscribeWhiteboardEvents,
    handleDataMessage,
    requestSyncState,
  };
}
