import { getLocaleFromLanguage } from "../i18n/locale";
import { chromeBookmarkUsage } from "./chrome-bookmark-usage";
import { chromeBookmarks } from "./chrome-bookmarks";
import { chromeLocalStorage } from "./chrome-storage";
import type { Platform } from "./types";

const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

export const platform: Platform = {
  bookmarkUsage: chromeBookmarkUsage,
  defaultLocale,
  search: {
    browserSearch: (text) =>
      chrome.search.query({ text, disposition: "CURRENT_TAB" }),
  },
  bookmarks: chromeBookmarks,
  localStorage: chromeLocalStorage,
  preferencesStorage: chromeLocalStorage,
};
