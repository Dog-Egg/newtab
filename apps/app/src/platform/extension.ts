import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY,
  normalizeLauncher,
} from "../Launcher/launcher";
import { importBrowserBookmarks } from "../browserBookmarks";
import {
  normalizeStoredWallpaperUrl,
  WALLPAPER_STORAGE_KEY,
} from "../wallpapers";
import type { Platform, StoredSearchEngineSettings } from "./types";
import {
  LAUNCHER_SETTINGS_STORAGE_KEY,
  normalizeLauncherSettings,
} from "../Launcher/launcherSettings";

const SEARCH_ENGINE_SETTINGS_KEY = "browser-tab.searchEngineSettings.v1";

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

function removeChromeStorage(key: string) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
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
  wallpaper: {
    read: () =>
      getChromeStorage(WALLPAPER_STORAGE_KEY, normalizeStoredWallpaperUrl),
    save: (wallpaperUrl) =>
      wallpaperUrl
        ? setChromeStorage(WALLPAPER_STORAGE_KEY, wallpaperUrl)
        : removeChromeStorage(WALLPAPER_STORAGE_KEY),
    subscribe: (onChange) =>
      subscribeChromeStorage(
        WALLPAPER_STORAGE_KEY,
        normalizeStoredWallpaperUrl,
        onChange,
      ),
  },
  launcherSettings: {
    read: () =>
      getChromeStorage(
        LAUNCHER_SETTINGS_STORAGE_KEY,
        normalizeLauncherSettings,
      ),
    save: (settings) =>
      setChromeStorage(LAUNCHER_SETTINGS_STORAGE_KEY, settings),
    subscribe: (onChange) =>
      subscribeChromeStorage(
        LAUNCHER_SETTINGS_STORAGE_KEY,
        normalizeLauncherSettings,
        onChange,
      ),
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
