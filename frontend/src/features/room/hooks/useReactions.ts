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
    // Generate a mini burst of 2 to 4 particles with slight variance
    const count = 3;
    const baseOriginX = 15 + Math.random() * 70; // 15% to 85% of screen width

    const newParticles: ReactionParticle[] = Array.from({ length: count }, (_, idx) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${idx}`;
      return {
        id,
        emoji,
        senderName,
        senderIdentity,
        x: Math.max(10, Math.min(90, baseOriginX + (Math.random() * 12 - 6))),
        speed: 2.2 + Math.random() * 0.8,
        scale: 0.85 + Math.random() * 0.45,
        swayAmount: (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 25),
        rotation: (Math.random() - 0.5) * 30,
      };
    });

    setParticles((prev) => [...prev.slice(-30), ...newParticles]);

    // Schedule auto removal after animation finishes (~2800ms)
    newParticles.forEach((p) => {
      const timeout = setTimeout(() => {
        setParticles((prev) => prev.filter((item) => item.id !== p.id));
        timeoutsRef.current.delete(p.id);
      }, 2800);
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
