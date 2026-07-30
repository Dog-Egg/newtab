import {
  createChromeBookmarkNode,
  getBookmarkTree,
} from "../../platform/chromeBookmarks";
import { migrateLegacyShortcutsOnce } from "./migrate";

function getChromeStorageItems(keys: string[]) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items);
    });
  });
}

function removeChromeStorageItem(key: string) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function removeChromeBookmarkFolder(id: string) {
  return new Promise<void>((resolve, reject) => {
    chrome.bookmarks.removeTree(id, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

/**
 * 旧 shortcuts 迁移属于扩展升级任务，不参与新标签页的正常启动流程。
 */
export function migrateShortcutsAfterExtensionUpdate(
  details: chrome.runtime.InstalledDetails,
) {
  if (details.reason !== "update") return Promise.resolve();

  return migrateLegacyShortcutsOnce({
    readStorage: getChromeStorageItems,
    removeStorage: removeChromeStorageItem,
    readBookmarks: getBookmarkTree,
    createBookmark: createChromeBookmarkNode,
    removeBookmarkFolder: removeChromeBookmarkFolder,
  });
}
