import { createContext, useContext } from "react";
import { useGameBoard } from "./useGameBoard";

type RoomGameContextValue = ReturnType<typeof useGameBoard>;

const RoomGameContext = createContext<RoomGameContextValue | null>(null);

export function RoomGameProvider({
  value,
  children,
}: {
  value: RoomGameContextValue;
  children: React.ReactNode;
}) {
  return (
    <RoomGameContext.Provider value={value}>
      {children}
    </RoomGameContext.Provider>
  );
}

const defaultGameContext: RoomGameContextValue = {
  gameBoard: {
    isActive: false,
    gameId: null,
    gameUrl: null,
    gameTitle: null,
    hostIdentity: null,
    acceptedParticipants: [],
    scores: {},
    classroomState: undefined,
  },
  pendingInvite: null,
  launchGame: async () => {},
  acceptGame: async () => {},
  declineGame: () => {},
  endGame: async () => {},
  relayScore: async () => {},
  broadcastClassroomEvent: async () => {},
  subscribeClassroomEvents: () => () => {},
  handleDataMessage: () => {},
};

export function useRoomGame(): RoomGameContextValue {
  const ctx = useContext(RoomGameContext);
  return ctx || defaultGameContext;
}
