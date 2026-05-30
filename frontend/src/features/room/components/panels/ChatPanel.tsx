import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChat, useLocalParticipant } from "@livekit/components-react";
import { Icons } from "../../../../lib/constants/icons";
import { cn } from "../../../../lib/utils";
import { useChatStore } from "../../store/chatStore";
import { getNameColor } from "./avatarHelpers";

/**
 * Hidden component that mirrors LiveKit chat messages into the local
 * Zustand store so the chat panel can survive remounts without losing
 * history. Lives next to ChatPanel because no other surface needs it.
 */
function ChatListener({ roomCode }: { roomCode: string }) {
  const { chatMessages } = useChat();
  const { addMessage } = useChatStore();
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    chatMessages.forEach((msg) => {
      const id = `${msg.from?.identity}-${msg.timestamp}`;
      if (!processedIds.current.has(id)) {
        processedIds.current.add(id);
        addMessage(roomCode, {
          id,
          from: msg.from?.identity || "",
          fromName: msg.from?.name || msg.from?.identity || "Unknown",
          message: msg.message,
          timestamp: msg.timestamp,
        });
      }
    });
  }, [chatMessages, roomCode]);

  return null;
}

const EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "👏",
  "🔥",
  "✅",
  "❓",
  "😊",
  "🙏",
  "💪",
  "👀",
];

interface ChatPanelProps {
  roomCode: string;
  /** Render the listener inline. Set false when the listener is mounted
   *  elsewhere (e.g., the docked sidebar already has it). */
  withListener?: boolean;
}

/**
 * In-call chat panel — message list plus composer.
 *
 * Reused by:
 *   - RoomSidebar (docked panel on tablet/desktop)
 *   - MobileSwipeShell page 3 (mobile swipe layout)
 *   - MobileSheetShell BottomSheet (mobile sheet layout)
 */
export default function ChatPanel({
  roomCode,
  withListener = true,
}: ChatPanelProps) {
  const { t } = useTranslation("room");
  const { send } = useChat();
  const { getMessages } = useChatStore();
  const { localParticipant } = useLocalParticipant();
  const messages = getMessages(roomCode);
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    send(message);
    setMessage("");
  };

  const myIdentity = localParticipant?.identity;

  return (
    <div className="flex flex-col h-full">
      {withListener && <ChatListener roomCode={roomCode} />}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-xs text-[var(--t3)]">
              {t("sidebar.noMessages")}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.from === myIdentity;
            const showName =
              !isMe && (i === 0 || messages[i - 1].from !== msg.from);

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col",
                  isMe ? "items-end" : "items-start",
                )}
              >
                {showName && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1 mb-0.5",
                      getNameColor(msg.from),
                    )}
                  >
                    {msg.fromName}
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed",
                    isMe
                      ? "bg-[var(--brand)] text-white rounded-br-sm"
                      : "bg-[var(--s3)] text-[var(--t1)] rounded-bl-sm",
                  )}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-[var(--t3)] px-1 mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showEmoji && (
        <div className="flex gap-1 px-1 py-2 border-t border-[var(--b)] flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                send(e);
                setShowEmoji(false);
              }}
              className="text-base hover:scale-125 transition-transform cursor-pointer bg-transparent border-none"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 pt-2 border-t border-[var(--b)] flex-shrink-0">
        <button
          onClick={() => setShowEmoji((p) => !p)}
          className={cn(
            "w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center text-base transition-all flex-shrink-0",
            showEmoji
              ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
              : "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)]",
          )}
        >
          😊
        </button>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("sidebar.messagePlaceholder")}
          className="flex-1 bg-[var(--s2)] border border-[var(--b)] rounded-lg px-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] outline-none focus:border-[var(--brand)] transition-colors min-w-0"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="w-8 h-8 bg-[var(--brand)] hover:bg-[var(--brand-h)] disabled:opacity-40 text-white rounded-lg border-none cursor-pointer flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
        >
          {Icons.send}
        </button>
      </div>
    </div>
  );
}
