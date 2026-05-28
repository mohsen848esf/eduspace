import { create } from "zustand";

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: number;
}

interface ChatStore {
  messagesByRoom: Record<string, ChatMessage[]>;
  addMessage: (roomCode: string, msg: ChatMessage) => void;
  clearRoom: (roomCode: string) => void;
  getMessages: (roomCode: string) => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messagesByRoom: {},

  addMessage: (roomCode, msg) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomCode]: [...(state.messagesByRoom[roomCode] || []), msg],
      },
    })),

  clearRoom: (roomCode) =>
    set((state) => {
      const updated = { ...state.messagesByRoom };
      delete updated[roomCode];
      return { messagesByRoom: updated };
    }),

  getMessages: (roomCode) => get().messagesByRoom[roomCode] || [],
}));
