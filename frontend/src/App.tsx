import { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import { useLocale } from "./i18n/useLocale";
import { useThemeStore } from "./store/themeStore";

export default function App() {
  const { language, dir } = useLocale();
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  return <AppRouter />;
}
