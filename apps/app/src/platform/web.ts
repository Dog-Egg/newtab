import {
  BOOKMARKS_STORAGE_KEY,
  DEMO_BOOKMARKS,
  type BookmarkNode,
  normalizeBookmarks,
} from "../bookmarks";
import {
  normalizeStoredWallpaperUrl,
  WALLPAPER_STORAGE_KEY,
} from "../wallpapers";
import type { Platform, StoredSearchEngineSettings } from "./types";

const SEARCH_ENGINE_SETTINGS_KEY = "browser-tab.searchEngineSettings.v1";

function readJsonStorageValue(key: string) {
  const saved = window.localStorage.getItem(key);
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
  window.localStorage.setItem(
    SEARCH_ENGINE_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function readStoredBookmarks() {
  const storedValue = readJsonStorageValue(BOOKMARKS_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return DEMO_BOOKMARKS;
  }

  return normalizeBookmarks(storedValue);
}

function saveStoredBookmarks(bookmarks: BookmarkNode[]) {
  window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
}

function readStoredWallpaperUrl() {
  return normalizeStoredWallpaperUrl(
    readJsonStorageValue(WALLPAPER_STORAGE_KEY),
  );
}

function saveStoredWallpaperUrl(wallpaperUrl: string | null) {
  if (wallpaperUrl) {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaperUrl);
    return;
  }

  window.localStorage.removeItem(WALLPAPER_STORAGE_KEY);
}

export const platform: Platform = {
  bookmarks: {
    read: async () => readStoredBookmarks(),
    save: async (bookmarks) => saveStoredBookmarks(bookmarks),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== BOOKMARKS_STORAGE_KEY) {
          return;
        }

        onChange(readStoredBookmarks());
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  wallpaper: {
    read: async () => readStoredWallpaperUrl(),
    save: async (wallpaperUrl) => saveStoredWallpaperUrl(wallpaperUrl),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== WALLPAPER_STORAGE_KEY) {
          return;
        }

        onChange(readStoredWallpaperUrl());
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
