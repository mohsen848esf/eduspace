import { createContext } from "react";

export interface PageHelpContextValue {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  triggerHelp: () => void;
}

export const PageHelpContext = createContext<PageHelpContextValue | undefined>(
  undefined,
);
