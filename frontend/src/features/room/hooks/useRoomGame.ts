import { useContext } from "react";
import { RoomGameContext, type RoomGameContextValue } from "./roomGameContext";

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
  return useContext(RoomGameContext) ?? defaultGameContext;
}
