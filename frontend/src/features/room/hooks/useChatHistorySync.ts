import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { useChatStore, type ChatMessage } from "../store/chatStore";
import type { Participant } from "livekit-client";
const TOPIC = "eduspace.chat-history.v1";
export function useChatHistorySync(roomCode: string) {
 const room = useRoomContext();
 const hostIdentity = useRoomStore((s) => s.permissionSnapshot?.host_identity);
 useEffect(() => {
  let disposed = false;
  const request = async () => {
   if (!hostIdentity || room.localParticipant.identity === hostIdentity || room.state !== "connected") return;
   await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "CHAT_REQUEST_HISTORY" })), { reliable: true, destinationIdentities: [hostIdentity] }).catch(() => undefined);
  };
  const onData = (data: Uint8Array, participant?: Participant) => {
   if (!participant || !useRoomStore.getState().isHost) return;
   try {
    if (JSON.parse(new TextDecoder().decode(data)).type !== "CHAT_REQUEST_HISTORY") return;
    const messages = useChatStore.getState().getMessages(roomCode).slice(-200);
    void room.localParticipant.sendText(JSON.stringify(messages), { topic: TOPIC, destinationIdentities: [participant.identity] }).catch(() => undefined);
   } catch { /* Other room messages. */ }
  };
  room.registerTextStreamHandler(TOPIC, async (reader, participant) => {
   try {
    if (participant.identity !== hostIdentity) return;
    const messages = JSON.parse(await reader.readAll()) as ChatMessage[];
    if (disposed || !Array.isArray(messages)) return;
    for (const msg of messages.slice(-200)) {
     if (typeof msg.id === "string" && typeof msg.from === "string" && typeof msg.message === "string" && typeof msg.timestamp === "number") useChatStore.getState().addMessage(roomCode, msg);
    }
   } catch { /* Keep local history if replay fails. */ }
  });
  room.on("dataReceived", onData); room.on("connected", request); room.on("reconnected", request);
  void request();
  return () => { disposed = true; room.unregisterTextStreamHandler(TOPIC); room.off("dataReceived", onData); room.off("connected", request); room.off("reconnected", request); };
 }, [room, roomCode, hostIdentity]);
}
