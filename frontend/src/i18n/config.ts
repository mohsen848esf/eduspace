import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enDashboard from "./locales/en/dashboard.json";
import enRoom from "./locales/en/room.json";
import enGames from "./locales/en/games.json";
import enMiniApps from "./locales/en/miniapps.json";
import enNotifications from "./locales/en/notifications.json";
import enRecordings from "./locales/en/recordings.json";

import faCommon from "./locales/fa/common.json";
import faAuth from "./locales/fa/auth.json";
import faDashboard from "./locales/fa/dashboard.json";
import faRoom from "./locales/fa/room.json";
import faGames from "./locales/fa/games.json";
import faMiniApps from "./locales/fa/miniapps.json";
import faNotifications from "./locales/fa/notifications.json";
import faRecordings from "./locales/fa/recordings.json";

export const SUPPORTED_LANGUAGES = ["en", "fa"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";
export const STORAGE_KEY = "eduspace_lang";

export const NAMESPACES = [
  "common",
  "auth",
  "dashboard",
  "room",
  "games",
  "miniapps",
  "notifications",
  "recordings",
] as const;

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    room: enRoom,
    games: enGames,
    miniapps: enMiniApps,
    notifications: enNotifications,
    recordings: enRecordings,
  },
  fa: {
    common: faCommon,
    auth: faAuth,
    dashboard: faDashboard,
    room: faRoom,
    games: faGames,
    miniapps: faMiniApps,
    notifications: faNotifications,
    recordings: faRecordings,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: "common",
    ns: [...NAMESPACES],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
