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

/**
 * Access the shared game state inside RoomContent.
 *
 * Calling this outside a RoomGameProvider throws — use it only inside
 * the room subtree (RoomTopbar / VideoGrid / RoomSidebar / GameBoard).
 */
export function useRoomGame(): RoomGameContextValue {
  const ctx = useContext(RoomGameContext);
  if (!ctx) {
    throw new Error("useRoomGame must be used within a RoomGameProvider");
  }
  return ctx;
}
