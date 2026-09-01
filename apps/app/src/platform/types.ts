import type { Settings } from "../Settings/schema";
import type { AppLocale } from "../i18n/locale";
import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";
import type { StoredSearchEngineSettings } from "../SearchEngineBox/schema";

type StorageUnsubscribe = () => void;

export type Platform = {
  defaultLocale: AppLocale;
  bookmarks: {
    read: () => Promise<BrowserBookmarkNode[]>;
    create: (bookmark: {
      parentId: string;
      title: string;
      url?: string;
      index?: number;
    }) => Promise<BrowserBookmarkNode>;
    update: (
      id: string,
      changes: { title?: string; url?: string },
    ) => Promise<BrowserBookmarkNode>;
    move: (
      id: string,
      destination: { parentId: string; index?: number },
    ) => Promise<BrowserBookmarkNode>;
    remove: (id: string) => Promise<void>;
    subscribe: (onChange: () => void) => StorageUnsubscribe;
  };
  settings: {
    read: () => Promise<Settings>;
    save: (settings: Settings) => Promise<void>;
    subscribe: (onChange: (settings: Settings) => void) => StorageUnsubscribe;
  };
  searchEngineSettings: {
    read: () => Promise<StoredSearchEngineSettings>;
    save: (settings: StoredSearchEngineSettings) => Promise<void>;
  };
};
