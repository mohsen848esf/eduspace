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

export function useRoomWhiteboard(): RoomWhiteboardContextValue {
  const ctx = useContext(RoomWhiteboardContext);
  if (!ctx) {
    throw new Error(
      "useRoomWhiteboard must be used within a RoomWhiteboardProvider"
    );
  }
  return ctx;
}
