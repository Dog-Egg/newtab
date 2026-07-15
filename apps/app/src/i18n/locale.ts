export const APP_LOCALES = ["en", "zh-CN"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function normalizeLocale(value: unknown): AppLocale {
  return value === "zh-CN" ? "zh-CN" : "en";
}

export function getLocaleFromLanguage(language: string): AppLocale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
