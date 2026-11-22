import { webBookmarkUsage } from "../bookmarks/web-bookmark-usage";
import { webBookmarks } from "../bookmarks/web-bookmarks";
import { getLocaleFromLanguage } from "../i18n/locale";
import type { Platform } from "./types";
import { webLocalStorage, webSessionStorage } from "./web-storage";

const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

export const platform: Platform = {
  bookmarkUsage: webBookmarkUsage,
  search: {},
  defaultLocale,
  bookmarks: webBookmarks,
  preferencesStorage: {
    read: async (key) => webSessionStorage.read(key),
    write: async (key, value) => webSessionStorage.write(key, value),
    subscribe: webSessionStorage.subscribe,
  },
  localStorage: {
    read: async (key) => webLocalStorage.read(key),
    write: async (key, value) => webLocalStorage.write(key, value),
    subscribe: webLocalStorage.subscribe,
  },
};
