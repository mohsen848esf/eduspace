import { useContext } from "react";
import {
  RoomWhiteboardContext,
  type RoomWhiteboardContextValue,
} from "./roomWhiteboardContext";

const defaultWhiteboardContext: RoomWhiteboardContextValue = {
  whiteboard: {
    isActive: false,
    isMinimized: false,
    hostIdentity: null,
    isDrawingAllowed: true,
  },
  launchWhiteboard: async () => {},
  endWhiteboard: async () => {},
  minimizeWhiteboard: () => {},
  restoreWhiteboard: () => {},
  toggleDrawingPermission: async () => {},
  broadcastWhiteboardEvent: async () => {},
  subscribeWhiteboardEvents: () => () => {},
  handleDataMessage: () => {},
  requestSyncState: async () => {},
};

export function useRoomWhiteboard(): RoomWhiteboardContextValue {
  return useContext(RoomWhiteboardContext) ?? defaultWhiteboardContext;
}
