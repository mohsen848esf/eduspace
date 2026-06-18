import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import HelpDrawer from "./HelpDrawer";
import { useTour } from "../tours/useTour";

interface PageHelpContextType {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  triggerHelp: () => void;
}

const PageHelpContext = createContext<PageHelpContextType | undefined>(undefined);

export function PageHelpProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const location = useLocation();
  const { startTour } = useTour();

  const triggerHelp = () => setHelpOpen(true);

  // Auto-run first visit tours on route change
  useEffect(() => {
    // Small delay ensures page elements have completed rendering before driver overlays trigger
    const timer = setTimeout(() => {
      startTour(location.pathname, false);
    }, 800);
    return () => clearTimeout(timer);
  }, [location.pathname, startTour]);

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
