import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
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
import { getDefaultCategoryNames } from "../Launcher/defaultLauncher";
import {
  BOOKMARK_LAYOUT_STORAGE_KEY,
  normalizeBookmarkLayout,
  type BookmarkLayoutCategory,
  type BrowserBookmark,
} from "../Launcher/bookmarkLayout";
import type { AppLocale } from "../i18n";
import { createWebBookmarkMocks } from "./webBookmarkMocks";

const WEB_BOOKMARKS_STORAGE_KEY = "web-bookmarks";
const webBookmarkListeners = new Set<() => void>();

const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

function logStorageOperation(
  operation: "read" | "write",
  key: string,
  value: unknown,
) {
  if (import.meta.env.DEV) {
    console.debug(`[persistence:${operation}]`, {
      storage: "sessionStorage",
      key,
      value,
    });
  }
}

function readJsonStorageValue(key: string) {
  const saved = window.sessionStorage.getItem(key);
  if (saved === null) {
    logStorageOperation("read", key, undefined);
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(saved);
    logStorageOperation("read", key, value);
    return value;
  } catch {
    logStorageOperation("read", key, saved);
    return saved;
  }
}

function writeJsonStorageValue(key: string, value: unknown) {
  window.sessionStorage.setItem(key, JSON.stringify(value));
  logStorageOperation("write", key, value);
}

function readStoredSearchEngineSettings(): StoredSearchEngineSettings {
  const storedValue = readJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY);
  if (!storedValue || typeof storedValue !== "object") {
    return {};
  }

  return storedValue as StoredSearchEngineSettings;
}

function saveStoredSearchEngineSettings(settings: StoredSearchEngineSettings) {
  writeJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY, settings);
}

function readStoredBookmarkLayout(locale: AppLocale) {
  const storedValue = readJsonStorageValue(BOOKMARK_LAYOUT_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return createWebBookmarkMocks(locale).layout;
  }

  return normalizeBookmarkLayout(
    storedValue,
    getDefaultCategoryNames(locale).home,
  );
}

function saveStoredBookmarkLayout(categories: BookmarkLayoutCategory[]) {
  writeJsonStorageValue(BOOKMARK_LAYOUT_STORAGE_KEY, categories);
}

function normalizeStoredWebBookmarks(value: unknown): BrowserBookmark[] | null {
  if (!Array.isArray(value)) return null;

  const bookmarks = value.flatMap<BrowserBookmark>((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const bookmark = candidate as Partial<BrowserBookmark>;
    return typeof bookmark.id === "string" &&
      bookmark.id &&
      typeof bookmark.title === "string" &&
      typeof bookmark.url === "string"
      ? [{ id: bookmark.id, title: bookmark.title, url: bookmark.url }]
      : [];
  });

  return bookmarks.filter(
    (bookmark, index, all) =>
      all.findIndex((candidate) => candidate.id === bookmark.id) === index,
  );
}

function readStoredWebBookmarks() {
  const storedValue = readJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY);
  return (
    normalizeStoredWebBookmarks(storedValue) ??
    createWebBookmarkMocks(defaultLocale).bookmarks
  );
}

function saveStoredWebBookmarks(bookmarks: BrowserBookmark[]) {
  writeJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY, bookmarks);
  // storage 事件不会回发到当前窗口，主动通知才能让编辑后的标题立即刷新。
  for (const listener of webBookmarkListeners) listener();
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
  writeJsonStorageValue(SETTINGS_STORAGE_KEY, settings);
}

export const platform: Platform = {
  defaultLocale,
  bookmarkLayout: {
    read: async (locale) => readStoredBookmarkLayout(locale),
    save: async (categories) => saveStoredBookmarkLayout(categories),
    subscribe: (locale, onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === BOOKMARK_LAYOUT_STORAGE_KEY) {
          onChange(readStoredBookmarkLayout(locale));
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  // Web 用 sessionStorage 模拟 chrome.bookmarks，预览中的增删改也能保持一致。
  bookmarks: {
    read: async () => readStoredWebBookmarks(),
    create: async (bookmark) => {
      const created = {
        ...bookmark,
        id: `web-bookmark-${window.crypto.randomUUID()}`,
      };
      saveStoredWebBookmarks([...readStoredWebBookmarks(), created]);
      return created;
    },
    update: async (id, changes) => {
      const bookmarks = readStoredWebBookmarks();
      const current = bookmarks.find((bookmark) => bookmark.id === id);
      if (!current) throw new Error(`Web bookmark not found: ${id}`);

      const updated = { ...current, ...changes };
      saveStoredWebBookmarks(
        bookmarks.map((bookmark) => (bookmark.id === id ? updated : bookmark)),
      );
      return updated;
    },
    remove: async (id) => {
      saveStoredWebBookmarks(
        readStoredWebBookmarks().filter((bookmark) => bookmark.id !== id),
      );
    },
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === WEB_BOOKMARKS_STORAGE_KEY) onChange();
      };
      webBookmarkListeners.add(onChange);
      window.addEventListener("storage", handleStorageChange);
      return () => {
        webBookmarkListeners.delete(onChange);
        window.removeEventListener("storage", handleStorageChange);
      };
    },
  },
  activeCategoryId: {
    read: async () => readStoredActiveCategoryId(),
    save: async (categoryId) =>
      writeJsonStorageValue(ACTIVE_CATEGORY_ID_STORAGE_KEY, categoryId),
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
};
