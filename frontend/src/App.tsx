import { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import { useLocale } from "./i18n/useLocale";

export default function App() {
  const { language, dir } = useLocale();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  return <AppRouter />;
}
