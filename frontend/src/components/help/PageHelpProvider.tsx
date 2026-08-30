import React, { useState } from "react";
import HelpDrawer from "./HelpDrawer";
import { PageHelpContext } from "./pageHelpContext";

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
