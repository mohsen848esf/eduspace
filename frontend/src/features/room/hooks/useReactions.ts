import { useState, useCallback, useRef, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";

export interface ReactionParticle {
  id: string;
  emoji: string;
  senderName: string;
  senderIdentity: string;
  x: number; // percentage 10% - 90%
  speed: number;
  scale: number;
  swayAmount: number;
  rotation: number;
}

export function useReactions() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [particles, setParticles] = useState<ReactionParticle[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const spawnParticles = useCallback((emoji: string, senderName: string, senderIdentity: string) => {
    // Google Meet style: 1-2 emojis per click in a continuous upward stream
    const count = Math.random() > 0.6 ? 2 : 1;
    // Anchor stream around center-bottom with organic spread (35% to 65%)
    const baseOriginX = 40 + Math.random() * 20;

    const newParticles: ReactionParticle[] = Array.from({ length: count }, (_, idx) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${idx}`;
      return {
        id,
        emoji,
        senderName,
        senderIdentity,
        x: Math.max(15, Math.min(85, baseOriginX + (Math.random() * 16 - 8))),
        speed: 2.2 + Math.random() * 0.6,
        scale: 0.9 + Math.random() * 0.35,
        swayAmount: (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 22),
        rotation: (Math.random() - 0.5) * 24,
      };
    });

    setParticles((prev) => [...prev.slice(-40), ...newParticles]);

    // Schedule auto removal after animation finishes (~2600ms)
    newParticles.forEach((p) => {
      const timeout = setTimeout(() => {
        setParticles((prev) => prev.filter((item) => item.id !== p.id));
        timeoutsRef.current.delete(p.id);
      }, 2600);
      timeoutsRef.current.set(p.id, timeout);
    });
  }, []);

  const sendReaction = useCallback(
    async (emoji: string) => {
      const senderName = localParticipant?.name || localParticipant?.identity || "کاربر";
      const senderIdentity = localParticipant?.identity || "";

      // Spawn immediately on local screen
      spawnParticles(emoji, senderName, senderIdentity);

      // Relay to other participants via LiveKit Data Channel
      if (room?.state === "connected") {
        try {
          const payload = JSON.stringify({
            type: "ROOM_REACTION",
            payload: {
              emoji,
              senderName,
              senderIdentity,
            },
          });
          const encoder = new TextEncoder();
          await room.localParticipant.publishData(encoder.encode(payload), {
            reliable: false,
          });
        } catch (e) {
          console.warn("Failed to publish reaction data", e);
        }
      }
    },
    [room, localParticipant, spawnParticles]
  );

  const handleDataMessage = useCallback(
    (payload: Uint8Array, participant?: any) => {
      try {
        const decoder = new TextDecoder();
        const msg = JSON.parse(decoder.decode(payload));
        if (msg.type === "ROOM_REACTION" && msg.payload) {
          const { emoji, senderName, senderIdentity } = msg.payload;
          if (emoji) {
            const name = senderName || participant?.name || participant?.identity || "کاربر";
            const identity = senderIdentity || participant?.identity || "";
            spawnParticles(emoji, name, identity);
          }
        }
      } catch {
        // Not a JSON reaction message, ignore safely
      }
    },
    [spawnParticles]
  );

  // Clean up all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    particles,
    sendReaction,
    handleDataMessage,
  };
}
