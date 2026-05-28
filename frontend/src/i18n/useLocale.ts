import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type Language } from "./config";

export function useLocale() {
  const { i18n } = useTranslation();

  const language = (i18n.resolvedLanguage || i18n.language || "en") as Language;
  const isRTL = language === "fa";
  const dir: "rtl" | "ltr" = isRTL ? "rtl" : "ltr";

  const setLanguage = useCallback(
    (lang: Language) => {
      void i18n.changeLanguage(lang);
    },
    [i18n],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "fa" : "en");
  }, [language, setLanguage]);

  return useMemo(
    () => ({
      language,
      isRTL,
      dir,
      supportedLanguages: SUPPORTED_LANGUAGES,
      setLanguage,
      toggleLanguage,
    }),
    [language, isRTL, dir, setLanguage, toggleLanguage],
  );
}
