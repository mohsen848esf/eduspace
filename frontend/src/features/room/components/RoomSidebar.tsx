import {
  useParticipants,
  useLocalParticipant,
  useChat,
  useTracks,
} from "@livekit/components-react";
import { useState, useRef, useEffect } from "react";
import { type SidebarTab } from "../hooks/useRoomControls";
import { Icons } from "../../../lib/constants/icons";
import { Strings } from "../../../lib/constants/strings";
import { cn } from "../../../lib/utils";

interface RoomSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  roomCode: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(identity: string): string {
  const gradients = [
    "from-[#6366f1] to-[#38bdf8]",
    "from-[#22c55e] to-[#38bdf8]",
    "from-[#f59e0b] to-[#f87171]",
    "from-[#e879f9] to-[#6366f1]",
    "from-[#f59e0b] to-[#22c55e]",
    "from-[#38bdf8] to-[#6366f1]",
  ];
  return gradients[identity.charCodeAt(0) % gradients.length];
}

// ── Participants Tab ──

function ParticipantsTab() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [showInvite, setShowInvite] = useState(false);
  const s = Strings.room;

  const host =
    participants.find((p) => p.permissions?.canPublish) || localParticipant;
  const others = participants.filter((p) => p.identity !== host.identity);

  const ParticipantRow = ({
    participant,
    isLocal,
  }: {
    participant: any;
    isLocal?: boolean;
  }) => {
    const name = participant.name || participant.identity;
    const gradient = getAvatarGradient(participant.identity);
    const { mutedByHost } = useRoomStore();
    const isMutedByHost = mutedByHost?.has(participant.identity);

    // Check actual mic state
    const tracks = useTracks([
      { source: Track.Source.Microphone, withPlaceholder: true },
    ]);
    const micTrack = tracks.find(
      (t) => t.participant.identity === participant.identity,
    );
    const isMicMuted =
      isMutedByHost || (micTrack?.publication?.isMuted ?? false);
    const isCamOff = !participant.isCameraEnabled;

    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--s3)] transition-colors cursor-pointer">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-gradient-to-br relative",
            gradient,
          )}
        >
          {getInitials(name)}
          {isMutedByHost && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--red)] rounded-full flex items-center justify-center text-[7px]">
              🔇
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-[var(--t1)] flex-1 truncate">
          {isLocal ? `${name} (You)` : name}
        </span>
        <div className="flex gap-1 items-center">
          <span
            className={cn(
              "text-xs",
              isMicMuted ? "text-[var(--red)]" : "text-[var(--t3)]",
            )}
          >
            {isMicMuted ? Icons.micOff : Icons.mic}
          </span>
          <span
            className={cn(
              "text-xs",
              isCamOff ? "text-[var(--red)]" : "text-[var(--t3)]",
            )}
          >
            {isCamOff ? Icons.cameraOff : Icons.camera}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 h-full">
      <button
        onClick={() => setShowInvite(true)}
        className="flex items-center justify-center gap-2 w-full py-2 mb-2 bg-[var(--brand-soft)] hover:bg-[var(--brand)]/15 text-[var(--brand-text)] text-xs font-semibold rounded-lg border-none cursor-pointer transition-all"
      >
        <span>+</span>
        Add People
      </button>
      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-2 py-1.5">
        {s.host}
      </div>
      <ParticipantRow participant={localParticipant} isLocal />

      {others.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-2 py-1.5 mt-2">
            {s.students} ({others.length})
          </div>
          {others.map((p) => (
            <ParticipantRow key={p.identity} participant={p} />
          ))}
        </>
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

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
// ── Chat Tab ──
function ChatTab({ roomCode }: { roomCode: string }) {
  const { send } = useChat();
  const { getMessages } = useChatStore();
  const { localParticipant } = useLocalParticipant();
  const messages = getMessages(roomCode);
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const emojis = [
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    send(message);
    setMessage("");
  };

  const myIdentity = localParticipant?.identity;

  const nameColors = [
    "text-[#818cf8]",
    "text-[#38bdf8]",
    "text-[#f59e0b]",
    "text-[#22c55e]",
    "text-[#e879f9]",
    "text-[#f87171]",
  ];
  const getNameColor = (identity: string) =>
    nameColors[identity.charCodeAt(0) % nameColors.length];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-xs text-[var(--t3)]">No messages yet</p>
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
          {emojis.map((e) => (
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
          placeholder="Message..."
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

// ── Tools Tab ──
function ToolsTab() {
  const s = Strings.tools;

  const tools = [
    {
      icon: "🎮",
      name: s.launchGame,
      desc: s.launchGameDesc,
      status: "ready" as const,
    },
    {
      icon: "📋",
      name: s.whiteboard,
      desc: s.whiteboardDesc,
      status: "ready" as const,
    },
    {
      icon: "📝",
      name: s.quickExam,
      desc: s.quickExamDesc,
      status: "ready" as const,
    },
    {
      icon: "🤖",
      name: s.aiSummary,
      desc: s.aiSummaryDesc,
      status: "soon" as const,
    },
    {
      icon: "📁",
      name: s.fileShare,
      desc: s.fileShareDesc,
      status: "soon" as const,
    },
  ];

  const iconBgs: Record<string, string> = {
    "🎮": "bg-[rgba(99,102,241,0.15)]",
    "📋": "bg-[rgba(56,189,248,0.12)]",
    "📝": "bg-[rgba(34,197,94,0.12)]",
    "🤖": "bg-[rgba(245,158,11,0.12)]",
    "📁": "bg-[rgba(248,113,113,0.12)]",
  };

  return (
    <div className="flex flex-col gap-1">
      {tools.map((tool) => (
        <button
          key={tool.name}
          disabled={tool.status === "soon"}
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--s3)] disabled:cursor-not-allowed transition-colors text-left border-none bg-transparent w-full"
        >
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0",
              iconBgs[tool.icon],
            )}
          >
            {tool.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[var(--t1)]">
              {tool.name}
            </div>
            <div className="text-[10px] text-[var(--t3)] mt-0.5">
              {tool.desc}
            </div>
          </div>
          {tool.status === "soon" ? (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(245,158,11,0.1)] text-[var(--amber)] flex-shrink-0">
              {Strings.common.soon}
            </span>
          ) : (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(34,197,94,0.1)] text-[var(--green)] flex-shrink-0">
              Ready
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Sidebar Tabs ──
const tabs: { id: SidebarTab; icon: React.ReactNode; tooltip: string }[] = [
  {
    id: "participants",
    icon: Icons.people,
    tooltip: Strings.room.tooltips.participants,
  },
  { id: "chat", icon: Icons.chat, tooltip: Strings.room.tooltips.chat },
  { id: "tools", icon: Icons.tools, tooltip: Strings.room.tooltips.tools },
];

import { Tooltip } from "../../../components/ui/Tooltip";
import React from "react";
import InviteModal from "./InviteModal";
import { useChatStore } from "../store/chatStore";
import { useRoomStore } from "../store/roomStore";
import { Track } from "livekit-client";

export default function RoomSidebar({
  activeTab,
  onTabChange,
  roomCode,
}: RoomSidebarProps) {
  if (!activeTab) return null;

  return (
    <div className="w-[272px] bg-[var(--s1)] border-l border-[var(--b)] flex flex-col flex-shrink-0 fade-in">
      {/* Tab buttons */}
      <ChatListener roomCode={roomCode} />

      <div className="flex items-center justify-center gap-1.5 p-2 border-b border-[var(--b)] flex-shrink-0">
        {tabs.map((tab) => (
          <Tooltip key={tab.id} content={tab.tooltip}>
            <button
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-9 h-9 rounded-lg border-none cursor-pointer",
                "flex items-center justify-center transition-all duration-150",
                activeTab === tab.id
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
              )}
            >
              {tab.icon}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-3">
        {activeTab === "participants" && <ParticipantsTab />}
        {activeTab === "chat" && <ChatTab roomCode={roomCode} />}
        {activeTab === "tools" && <ToolsTab />}
      </div>
    </div>
  );
}
