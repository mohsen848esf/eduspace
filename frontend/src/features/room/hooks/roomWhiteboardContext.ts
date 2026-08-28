import { createContext } from "react";
import type { useWhiteboard } from "./useWhiteboard";

export type RoomWhiteboardContextValue = ReturnType<typeof useWhiteboard>;

export const RoomWhiteboardContext =
  createContext<RoomWhiteboardContextValue | null>(null);
