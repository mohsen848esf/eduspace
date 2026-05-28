import { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import { useLocale } from "./i18n/useLocale";

export default function App() {
  const { language, dir } = useLocale();

  useEffect(() => {
    document.documentElement.lang = language;
    // Note: full RTL layout work happens in the rtl-layout branch.
    // We still sync `dir` so platform widgets (selects, tooltips) get the right direction.
    document.documentElement.dir = dir;
  }, [language, dir]);

  return <AppRouter />;
}
