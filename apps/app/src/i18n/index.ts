import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
export { APP_LOCALES, normalizeLocale } from "./locale";
export type { AppLocale } from "./locale";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "zh-CN": { translation: zhCN } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
