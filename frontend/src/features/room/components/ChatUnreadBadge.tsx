import { useLocalParticipant } from "@livekit/components-react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../store/chatStore";
import { useRoomStore } from "../store/roomStore";
export default function ChatUnreadBadge() {
  const { t } = useTranslation("room");
  const code = useRoomStore((s) => s.roomCode) || "";
  const { localParticipant } = useLocalParticipant();
  const count = useChatStore((s) => (s.messagesByRoom[code] || []).filter((m) => m.from !== localParticipant.identity).length - (s.readCountByRoom[code] || 0));
  return count > 0 ? <span role="status" aria-label={t("sidebar.unread", { count })} className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-[var(--red)] text-white text-[10px] flex items-center justify-center">{count > 99 ? "99+" : count}</span> : null;
}
