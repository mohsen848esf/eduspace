import React, { createContext, useContext, useState } from "react";
import HelpDrawer from "./HelpDrawer";

interface PageHelpContextType {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  triggerHelp: () => void;
}

const PageHelpContext = createContext<PageHelpContextType | undefined>(undefined);

export function PageHelpProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);

  const triggerHelp = () => setHelpOpen(true);

  return (
    <PageHelpContext.Provider value={{ helpOpen, setHelpOpen, triggerHelp }}>
      {children}
      <HelpDrawer open={helpOpen} onOpenChange={setHelpOpen} />
    </PageHelpContext.Provider>
  );
}

export function usePageHelp() {
  const context = useContext(PageHelpContext);
  if (!context) {
    throw new Error("usePageHelp must be used within a PageHelpProvider");
  }
  return context;
}
