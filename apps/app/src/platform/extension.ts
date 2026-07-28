import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
} from "../Launcher/launcher";
import { importBrowserBookmarks } from "../browserBookmarks";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";
import { normalizeStoredExtensionLauncher } from "../Launcher/defaultLauncher";
import { getDefaultCategoryNames } from "../Launcher/defaultLauncher";
import {
  BOOKMARK_LAYOUT_STORAGE_KEY,
  normalizeBookmarkLayout,
  type BrowserBookmark,
} from "../Launcher/bookmarkLayout";
import { getAllBookmarkItems } from "../next/bookmarks";
const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

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

function getBookmarkError() {
  const error = chrome.runtime.lastError;
  return error ? new Error(error.message) : null;
}

function createBookmark(
  details: chrome.bookmarks.CreateDetails,
): Promise<BrowserBookmark> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(details, (bookmark) => {
      const error = getBookmarkError();
      if (error) {
        reject(error);
        return;
      }
      if (!bookmark.url) {
        reject(new Error("Chrome created a bookmark without a URL"));
        return;
      }
      resolve({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
      });
    });
  });
}

function updateBookmark(
  id: string,
  changes: chrome.bookmarks.UpdateChanges,
): Promise<BrowserBookmark> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, changes, (bookmark) => {
      const error = getBookmarkError();
      if (error) {
        reject(error);
        return;
      }
      if (!bookmark.url) {
        reject(new Error("Chrome updated bookmark without a URL"));
        return;
      }
      resolve({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
      });
    });
  });
}

function removeBookmark(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.remove(id, () => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve();
    });
  });
}

function subscribeBookmarks(onChange: () => void) {
  chrome.bookmarks.onCreated.addListener(onChange);
  chrome.bookmarks.onChanged.addListener(onChange);
  chrome.bookmarks.onRemoved.addListener(onChange);
  return () => {
    chrome.bookmarks.onCreated.removeListener(onChange);
    chrome.bookmarks.onChanged.removeListener(onChange);
    chrome.bookmarks.onRemoved.removeListener(onChange);
  };
}

export const platform: Platform = {
  defaultLocale,
  launcher: {
    read: (locale) =>
      getChromeStorage(LAUNCHER_STORAGE_KEY, (value) =>
        normalizeStoredExtensionLauncher(value, locale),
      ),
    save: (categories) => setChromeStorage(LAUNCHER_STORAGE_KEY, categories),
    subscribe: (locale, onChange) =>
      subscribeChromeStorage(
        LAUNCHER_STORAGE_KEY,
        (value) => normalizeStoredExtensionLauncher(value, locale),
        onChange,
      ),
  },
  bookmarkLayout: {
    read: (locale) =>
      getChromeStorage(BOOKMARK_LAYOUT_STORAGE_KEY, (value) =>
        normalizeBookmarkLayout(value, getDefaultCategoryNames(locale).home),
      ),
    save: (categories) =>
      setChromeStorage(BOOKMARK_LAYOUT_STORAGE_KEY, categories),
    subscribe: (locale, onChange) =>
      subscribeChromeStorage(
        BOOKMARK_LAYOUT_STORAGE_KEY,
        (value) =>
          normalizeBookmarkLayout(value, getDefaultCategoryNames(locale).home),
        onChange,
      ),
  },
  bookmarks: {
    read: async () =>
      (await getAllBookmarkItems()).map(({ id, title, url }) => ({
        id,
        title,
        url,
      })),
    create: (bookmark) => createBookmark(bookmark),
    update: (id, changes) => updateBookmark(id, changes),
    remove: removeBookmark,
    subscribe: subscribeBookmarks,
  },
  activeCategoryId: {
    read: () =>
      getChromeStorage(ACTIVE_CATEGORY_ID_STORAGE_KEY, (value) =>
        typeof value === "string" ? value : DEFAULT_CATEGORY_ID,
      ),
    save: (categoryId) =>
      setChromeStorage(ACTIVE_CATEGORY_ID_STORAGE_KEY, categoryId),
    subscribe: (onChange) =>
      subscribeChromeStorage(
        ACTIVE_CATEGORY_ID_STORAGE_KEY,
        (value) => (typeof value === "string" ? value : DEFAULT_CATEGORY_ID),
        onChange,
      ),
  },
  settings: {
    read: () =>
      getChromeStorage(SETTINGS_STORAGE_KEY, (value) =>
        normalizeSettings(value, defaultLocale),
      ),
    save: (settings) => setChromeStorage(SETTINGS_STORAGE_KEY, settings),
    subscribe: (onChange) =>
      subscribeChromeStorage(
        SETTINGS_STORAGE_KEY,
        (value) => normalizeSettings(value, defaultLocale),
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
