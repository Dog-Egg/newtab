import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
  normalizeLauncher,
} from "../Launcher/launcher";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";
import {
  createDefaultCategory,
  createDefaultLauncher,
} from "../Launcher/defaultLauncher";
import type { AppLocale } from "../i18n";

const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

function readJsonStorageValue(key: string) {
  const saved = window.sessionStorage.getItem(key);
  if (!saved) {
    return undefined;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return saved;
  }
}

function readStoredSearchEngineSettings(): StoredSearchEngineSettings {
  const storedValue = readJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY);
  if (!storedValue || typeof storedValue !== "object") {
    return {};
  }

  return storedValue as StoredSearchEngineSettings;
}

function saveStoredSearchEngineSettings(settings: StoredSearchEngineSettings) {
  window.sessionStorage.setItem(
    SEARCH_ENGINE_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function readStoredLauncher(locale: AppLocale) {
  const storedValue = readJsonStorageValue(LAUNCHER_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return createDefaultLauncher(locale);
  }

  return normalizeLauncher(storedValue, createDefaultCategory(locale));
}

function saveStoredLauncher(categories: ReturnType<typeof normalizeLauncher>) {
  window.sessionStorage.setItem(
    LAUNCHER_STORAGE_KEY,
    JSON.stringify(categories),
  );
}

function readStoredActiveCategoryId() {
  const value = readJsonStorageValue(ACTIVE_CATEGORY_ID_STORAGE_KEY);
  return typeof value === "string" ? value : DEFAULT_CATEGORY_ID;
}

function readStoredSettings() {
  return normalizeSettings(
    readJsonStorageValue(SETTINGS_STORAGE_KEY),
    defaultLocale,
  );
}

function saveStoredSettings(settings: Settings) {
  window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export const platform: Platform = {
  defaultLocale,
  launcher: {
    read: async (locale) => readStoredLauncher(locale),
    save: async (categories) => saveStoredLauncher(categories),
    subscribe: (locale, onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== LAUNCHER_STORAGE_KEY) {
          return;
        }

        onChange(readStoredLauncher(locale));
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  activeCategoryId: {
    read: async () => readStoredActiveCategoryId(),
    save: async (categoryId) =>
      window.sessionStorage.setItem(
        ACTIVE_CATEGORY_ID_STORAGE_KEY,
        JSON.stringify(categoryId),
      ),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === ACTIVE_CATEGORY_ID_STORAGE_KEY) {
          onChange(readStoredActiveCategoryId());
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  settings: {
    read: async () => readStoredSettings(),
    save: async (settings) => saveStoredSettings(settings),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === SETTINGS_STORAGE_KEY) {
          onChange(readStoredSettings());
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  searchEngineSettings: {
    read: async () => readStoredSearchEngineSettings(),
    save: async (settings) => saveStoredSearchEngineSettings(settings),
  },
  browserBookmarks: {
    import: async () => {
      return {
        importedCount: 0,
        skippedDuplicateCount: 0,
        folderCount: 0,
        unsupported: true,
      };
    },
  },
};
