const APP_LOCALES = ["en", "zh-CN"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function getLocaleFromLanguage(language: string): AppLocale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
