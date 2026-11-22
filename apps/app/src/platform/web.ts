import { webBookmarkUsage } from "../bookmarks/web-bookmark-usage";
import { webBookmarks } from "../bookmarks/web-bookmarks";
import { getLocaleFromLanguage } from "../i18n/locale";
import type { Platform } from "./types";
import { webLocalStorage, webSessionStorage } from "./web-storage";

const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

function asAsyncStorage(
  storage: typeof webLocalStorage,
): Platform["localStorage"] {
  return {
    read: async (key) => storage.read(key),
    write: async (key, value) => storage.write(key, value),
    subscribe: storage.subscribe,
  };
}

export const platform: Platform = {
  bookmarkUsage: webBookmarkUsage,
  search: {},
  defaultLocale,
  bookmarks: webBookmarks,
  preferencesStorage: asAsyncStorage(webSessionStorage),
  localStorage: asAsyncStorage(webLocalStorage),
};
