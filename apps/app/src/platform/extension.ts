import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY,
  normalizeLauncher,
} from "../Launcher/launcher";
import { importBrowserBookmarks } from "../browserBookmarks";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "../Settings/settings";

function getChromeStorage<T>(key: string, normalize: (value: unknown) => T) {
  return new Promise<T>((resolve, reject) => {
    chrome.storage.local.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(normalize(items[key]));
    });
  });
}

function setChromeStorage(key: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function normalizeSearchEngineSettings(
  value: unknown,
): StoredSearchEngineSettings {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as StoredSearchEngineSettings;
}

function subscribeChromeStorage<T>(
  key: string,
  normalize: (value: unknown) => T,
  onChange: (value: T) => void,
) {
  const handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !changes[key]) {
      return;
    }

    onChange(normalize(changes[key].newValue));
  };

  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => chrome.storage.onChanged.removeListener(handleStorageChange);
}

export const platform: Platform = {
  launcher: {
    read: () => getChromeStorage(LAUNCHER_STORAGE_KEY, normalizeLauncher),
    save: (categories) => setChromeStorage(LAUNCHER_STORAGE_KEY, categories),
    subscribe: (onChange) =>
      subscribeChromeStorage(LAUNCHER_STORAGE_KEY, normalizeLauncher, onChange),
  },
  activeCategoryId: {
    read: () =>
      getChromeStorage(ACTIVE_CATEGORY_ID_STORAGE_KEY, (value) =>
        typeof value === "string" ? value : DEFAULT_CATEGORY.id,
      ),
    save: (categoryId) =>
      setChromeStorage(ACTIVE_CATEGORY_ID_STORAGE_KEY, categoryId),
    subscribe: (onChange) =>
      subscribeChromeStorage(
        ACTIVE_CATEGORY_ID_STORAGE_KEY,
        (value) => (typeof value === "string" ? value : DEFAULT_CATEGORY.id),
        onChange,
      ),
  },
  settings: {
    read: () => getChromeStorage(SETTINGS_STORAGE_KEY, normalizeSettings),
    save: (settings) => setChromeStorage(SETTINGS_STORAGE_KEY, settings),
    subscribe: (onChange) =>
      subscribeChromeStorage(SETTINGS_STORAGE_KEY, normalizeSettings, onChange),
  },
  searchEngineSettings: {
    read: () =>
      getChromeStorage(
        SEARCH_ENGINE_SETTINGS_KEY,
        normalizeSearchEngineSettings,
      ),
    save: (settings) => setChromeStorage(SEARCH_ENGINE_SETTINGS_KEY, settings),
  },
  browserBookmarks: {
    import: importBrowserBookmarks,
  },
};
