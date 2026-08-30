import { RoomGameContext, type RoomGameContextValue } from "./roomGameContext";

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
