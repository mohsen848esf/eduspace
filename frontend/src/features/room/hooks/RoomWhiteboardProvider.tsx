import {
  RoomWhiteboardContext,
  type RoomWhiteboardContextValue,
} from "./roomWhiteboardContext";

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
