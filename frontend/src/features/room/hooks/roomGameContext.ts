import { createContext } from "react";
import type { useGameBoard } from "./useGameBoard";

export type RoomGameContextValue = ReturnType<typeof useGameBoard>;

export const RoomGameContext = createContext<RoomGameContextValue | null>(null);
