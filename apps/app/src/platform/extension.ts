import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
} from "../Launcher/launcher";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";
import { normalizeStoredExtensionLauncher } from "../Launcher/defaultLauncher";
import {
  getDefaultCategoryNames,
  getOtherBookmarksFolderTitle,
} from "../Launcher/defaultLauncher";
import {
  BOOKMARK_LAYOUT_STORAGE_KEY,
  normalizeBookmarkLayout,
  type BookmarkLayoutCategory,
  type BrowserBookmark,
} from "../Launcher/bookmarkLayout";
import {
  collectLegacyShortcutsToExport,
  migrateLegacyLauncherToBookmarkLayout,
} from "../Launcher/migration/legacyLauncher";
import { getAllBookmarkItems } from "./chromeBookmarks";
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

function getChromeStorageItems(keys: string[]) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items);
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

function createChromeBookmarkNode(
  details: chrome.bookmarks.CreateDetails,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(details, (bookmark) => {
      const error = getBookmarkError();
      if (error) {
        reject(error);
        return;
      }
      resolve(bookmark);
    });
  });
}

async function createBookmark(
  details: chrome.bookmarks.CreateDetails,
): Promise<BrowserBookmark> {
  const bookmark = await createChromeBookmarkNode(details);

  if (!bookmark.url) {
    throw new Error("Chrome created a bookmark without a URL");
  }

  return {
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
  };
}

function toBrowserBookmarks(
  bookmarks: Awaited<ReturnType<typeof getAllBookmarkItems>>,
): BrowserBookmark[] {
  return bookmarks.map(({ id, title, url }) => ({ id, title, url }));
}

let pendingBookmarkLayoutRead: Promise<BookmarkLayoutCategory[]> | null = null;
const LEGACY_LAUNCHER_MIGRATION_LOCK = "legacy-launcher-bookmark-migration";

async function readStoredBookmarkLayout(locale: typeof defaultLocale) {
  const items = await getChromeStorageItems([
    BOOKMARK_LAYOUT_STORAGE_KEY,
    LAUNCHER_STORAGE_KEY,
  ]);

  // key 存在即表示用户已经进入新数据结构；即使值损坏也不能回头覆盖它。
  if (
    Object.prototype.hasOwnProperty.call(items, BOOKMARK_LAYOUT_STORAGE_KEY)
  ) {
    return normalizeBookmarkLayout(
      items[BOOKMARK_LAYOUT_STORAGE_KEY],
      getDefaultCategoryNames(locale).home,
    );
  }

  const legacyCategories = normalizeStoredExtensionLauncher(
    items[LAUNCHER_STORAGE_KEY],
    locale,
  );
  let browserBookmarks = toBrowserBookmarks(await getAllBookmarkItems());
  const shortcutsToExport = collectLegacyShortcutsToExport(
    legacyCategories,
    browserBookmarks,
  );

  if (shortcutsToExport.length > 0) {
    // 延续原“导出快捷方式”行为：集中放入 Chrome 的 NewTab 目录。
    const folder = await createChromeBookmarkNode({ title: "NewTab" });
    for (const shortcut of shortcutsToExport) {
      await createChromeBookmarkNode({
        parentId: folder.id,
        title: shortcut.title,
        url: shortcut.url,
      });
    }

    // Chrome 分配 ID 后必须重新读取；迁移结果不能引用旧 Shortcut ID。
    browserBookmarks = toBrowserBookmarks(await getAllBookmarkItems());
  }

  // 这里只返回内存布局。用户第一次修改排序或嵌套时才由 save() 正式落盘。
  return migrateLegacyLauncherToBookmarkLayout(
    legacyCategories,
    browserBookmarks,
    getOtherBookmarksFolderTitle(locale),
  );
}

function readBookmarkLayout(locale: typeof defaultLocale) {
  // Promise 防止同一页面重复执行；Web Lock 再把多个同时打开的新标签页串行化，
  // 后进入的页面会重新读取 Chrome Bookmarks，因此不会重复导出同一批 URL。
  if (!pendingBookmarkLayoutRead) {
    const read = () => readStoredBookmarkLayout(locale);
    const result =
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks
            .request(LEGACY_LAUNCHER_MIGRATION_LOCK, read)
            .then((layout) => layout)
        : read();
    const pending = result.finally(() => {
      pendingBookmarkLayoutRead = null;
    });
    pendingBookmarkLayoutRead = pending;
    return pending;
  }
  return pendingBookmarkLayoutRead;
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
  bookmarkLayout: {
    read: readBookmarkLayout,
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
    read: async () => toBrowserBookmarks(await getAllBookmarkItems()),
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
};
