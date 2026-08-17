import { createContext, useContext } from "react";
import { useWhiteboard } from "./useWhiteboard";

type RoomWhiteboardContextValue = ReturnType<typeof useWhiteboard>;

const RoomWhiteboardContext = createContext<RoomWhiteboardContextValue | null>(null);

export function RoomWhiteboardProvider({
  value,
  children,
}: {
  value: RoomWhiteboardContextValue;
  children: React.ReactNode;
}) {
  return (
    <RoomWhiteboardContext.Provider value={value}>
      {children}
    </RoomWhiteboardContext.Provider>
  );
}

const defaultWhiteboardState = {
  isActive: false,
  isMinimized: false,
  hostIdentity: null,
  isDrawingAllowed: true,
};

const defaultWhiteboardContext: RoomWhiteboardContextValue = {
  whiteboard: defaultWhiteboardState,
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
  const ctx = useContext(RoomWhiteboardContext);
  return ctx || defaultWhiteboardContext;
}
