import {
  SHORTCUTS_STORAGE_KEY,
  type ShortcutNode,
  normalizeShortcuts,
} from "../shortcuts";
import {
  normalizeStoredWallpaperUrl,
  WALLPAPER_STORAGE_KEY,
} from "../wallpapers";
import type { Platform, StoredSearchEngineSettings } from "./types";

const SEARCH_ENGINE_SETTINGS_KEY = "browser-tab.searchEngineSettings.v1";

const DEFAULT_SHORTCUTS: ShortcutNode[] = [
  {
    type: "item",
    id: "https://trello.com",
    title: "Trello",
    url: "https://trello.com",
    createdAt: 1,
  },
  {
    type: "item",
    id: "https://home.mi.com",
    title: "米家",
    url: "https://home.mi.com",
    createdAt: 2,
  },
  {
    type: "item",
    id: "https://cmbchina.com",
    title: "招商银行",
    url: "https://cmbchina.com",
    createdAt: 3,
  },
  {
    type: "item",
    id: "https://pan.baidu.com",
    title: "百度网盘",
    url: "https://pan.baidu.com",
    createdAt: 4,
  },
  {
    type: "item",
    id: "https://10010.com",
    title: "联通",
    url: "https://10010.com",
    createdAt: 5,
  },
  {
    type: "item",
    id: "https://trip.com",
    title: "Trip",
    url: "https://trip.com",
    createdAt: 6,
  },
  {
    type: "item",
    id: "https://ctrip.com",
    title: "携程",
    url: "https://ctrip.com",
    createdAt: 7,
  },
  {
    type: "item",
    id: "https://1password.com",
    title: "1Password",
    url: "https://1password.com",
    createdAt: 8,
  },
  {
    type: "item",
    id: "https://www.xiachufang.com",
    title: "下厨房",
    url: "https://www.xiachufang.com",
    createdAt: 9,
  },
];

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

function readStoredShortcuts() {
  const storedValue = readJsonStorageValue(SHORTCUTS_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return DEFAULT_SHORTCUTS;
  }

  return normalizeShortcuts(storedValue);
}

function saveStoredShortcuts(shortcuts: ShortcutNode[]) {
  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
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
  shortcuts: {
    read: async () => readStoredShortcuts(),
    save: async (shortcuts) => saveStoredShortcuts(shortcuts),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== SHORTCUTS_STORAGE_KEY) {
          return;
        }

        onChange(readStoredShortcuts());
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
