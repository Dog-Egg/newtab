import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";
import {
  createChromeBookmarkNode,
  getBookmarkTree,
  toBrowserBookmarkNode,
  toChromeMoveDestination,
} from "./chromeBookmarks";
import { getChromeStorage, setChromeStorage } from "./chromeStorage";

const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

function normalizeSearchEngineSettings(
  value: unknown,
): StoredSearchEngineSettings {
  return value && typeof value === "object"
    ? (value as StoredSearchEngineSettings)
    : {};
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
    if (areaName === "local" && changes[key]) {
      onChange(normalize(changes[key].newValue));
    }
  };
  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => chrome.storage.onChanged.removeListener(handleStorageChange);
}

function getBookmarkError() {
  const error = chrome.runtime.lastError;
  return error ? new Error(error.message) : null;
}

function updateBookmark(
  id: string,
  changes: chrome.bookmarks.UpdateChanges,
): Promise<BrowserBookmarkNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, changes, (bookmark) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve(toBrowserBookmarkNode(bookmark));
    });
  });
}

async function moveBookmark(
  id: string,
  destination: chrome.bookmarks.MoveDestination,
): Promise<BrowserBookmarkNode> {
  const current = await getChromeBookmark(id);
  const chromeDestination = toChromeMoveDestination(current, destination);

  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(id, chromeDestination, (bookmark) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve(toBrowserBookmarkNode(bookmark));
    });
  });
}

function getChromeBookmark(id: string) {
  return new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
    chrome.bookmarks.get(id, (nodes) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else if (!nodes[0]) reject(new Error(`Bookmark not found: ${id}`));
      else resolve(nodes[0]);
    });
  });
}

async function removeBookmark(id: string): Promise<void> {
  const bookmark = await getChromeBookmark(id);
  return new Promise((resolve, reject) => {
    const done = () => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve();
    };
    // 文件夹可能包含任意深度的后代，必须使用 removeTree。
    if (bookmark.url) chrome.bookmarks.remove(id, done);
    else chrome.bookmarks.removeTree(id, done);
  });
}

function subscribeBookmarks(onChange: () => void) {
  chrome.bookmarks.onCreated.addListener(onChange);
  chrome.bookmarks.onChanged.addListener(onChange);
  chrome.bookmarks.onMoved.addListener(onChange);
  chrome.bookmarks.onRemoved.addListener(onChange);
  chrome.bookmarks.onChildrenReordered.addListener(onChange);
  chrome.bookmarks.onImportEnded.addListener(onChange);
  return () => {
    chrome.bookmarks.onCreated.removeListener(onChange);
    chrome.bookmarks.onChanged.removeListener(onChange);
    chrome.bookmarks.onMoved.removeListener(onChange);
    chrome.bookmarks.onRemoved.removeListener(onChange);
    chrome.bookmarks.onChildrenReordered.removeListener(onChange);
    chrome.bookmarks.onImportEnded.removeListener(onChange);
  };
}

export const platform: Platform = {
  defaultLocale,
  bookmarks: {
    read: getBookmarkTree,
    create: async (bookmark) =>
      toBrowserBookmarkNode(await createChromeBookmarkNode(bookmark)),
    update: updateBookmark,
    move: moveBookmark,
    remove: removeBookmark,
    subscribe: subscribeBookmarks,
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
};
