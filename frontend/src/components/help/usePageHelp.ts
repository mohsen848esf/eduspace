import { useContext } from "react";
import { PageHelpContext } from "./pageHelpContext";

export function usePageHelp() {
  const context = useContext(PageHelpContext);
  if (!context) {
    throw new Error("usePageHelp must be used within a PageHelpProvider");
  }
  return context;
}
