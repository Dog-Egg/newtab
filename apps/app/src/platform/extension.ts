import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";
import type { Platform } from "./types";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  searchEngineSettingsSchema,
} from "../SearchEngineBox/schema";
import {
  SETTINGS_STORAGE_KEY,
  settingsSchema,
  type Settings,
} from "../Settings/schema";
import { getLocaleFromLanguage } from "../i18n/locale";
import {
  createChromeBookmarkNode,
  getBookmarkTree,
  toBrowserBookmarkNode,
  toChromeMoveDestination,
} from "./chromeBookmarks";
import { getChromeStorage, setChromeStorage } from "./chromeStorage";

const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

function parseStoredSettings(value: unknown): Settings {
  const storedSettings = settingsSchema.parse(value);
  return {
    ...storedSettings,
    locale: storedSettings.locale ?? defaultLocale,
  };
}

function subscribeChromeStorage(
  key: string,
  onChange: (value: unknown) => void,
) {
  const handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName === "local" && changes[key]) {
      onChange(changes[key].newValue);
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
    read: async () => {
      try {
        return parseStoredSettings(
          await getChromeStorage(SETTINGS_STORAGE_KEY),
        );
      } catch (error: unknown) {
        console.error("Failed to read settings", error);
        return parseStoredSettings(undefined);
      }
    },
    save: (settings) => setChromeStorage(SETTINGS_STORAGE_KEY, settings),
    subscribe: (onChange) =>
      subscribeChromeStorage(SETTINGS_STORAGE_KEY, (value) =>
        onChange(parseStoredSettings(value)),
      ),
  },
  searchEngineSettings: {
    read: async () => {
      try {
        return searchEngineSettingsSchema.parse(
          await getChromeStorage(SEARCH_ENGINE_SETTINGS_KEY),
        );
      } catch (error: unknown) {
        console.error("Failed to read search engine settings", error);
        return searchEngineSettingsSchema.parse(undefined);
      }
    },
    save: (settings) => setChromeStorage(SEARCH_ENGINE_SETTINGS_KEY, settings),
  },
};
