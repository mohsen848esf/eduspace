import { create } from "zustand";

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: number;
}

export const EMPTY_CHAT_MESSAGES: readonly ChatMessage[] = [];

interface ChatStore {
  readCountByRoom: Record<string, number>;
  markRead: (roomCode: string, count: number) => void;
  messagesByRoom: Record<string, ChatMessage[]>;
  addMessage: (roomCode: string, msg: ChatMessage) => void;
  clearRoom: (roomCode: string) => void;
  getMessages: (roomCode: string) => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messagesByRoom: {},
  readCountByRoom: {},
  markRead: (roomCode, count) =>
    set((state) => {
      const current = state.readCountByRoom[roomCode] ?? 0;
      if (current === count) return state;

      return {
        readCountByRoom: {
          ...state.readCountByRoom,
          [roomCode]: count,
        },
      };
    }),

  addMessage: (roomCode, msg) => set((state) => {
    const messages = state.messagesByRoom[roomCode] || [];
    const existing = messages.findIndex((item) => item.id === msg.id);
    if (existing >= 0 && messages[existing].message === msg.message) return state;
    const next = [...messages];
    if (existing >= 0) next[existing] = msg; else { next.push(msg); next.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)); }
    return { messagesByRoom: { ...state.messagesByRoom, [roomCode]: next } };
  }),

  clearRoom: (roomCode) =>
    set((state) => {
      const updated = { ...state.messagesByRoom };
      delete updated[roomCode];
      const readCounts = { ...state.readCountByRoom }; delete readCounts[roomCode];
      return { messagesByRoom: updated, readCountByRoom: readCounts };
    }),

  getMessages: (roomCode) => get().messagesByRoom[roomCode] || [],
}));
