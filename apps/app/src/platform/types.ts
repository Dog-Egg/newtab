import type { StoredSearchEngineSettings } from "../search-engine-box/schema";
import type { Settings } from "../settings/schema";
import type { AppLocale } from "../i18n/locale";
import type { BrowserBookmarkNode } from "../launcher/bookmark-tree";

type StorageUnsubscribe = () => void;

export type Platform = {
  defaultLocale: AppLocale;
  search: {
    defaultEngineId: string;
    browserSearch?: (text: string) => Promise<void>;
  };
  searchEngineSettings: {
    read: () => Promise<StoredSearchEngineSettings>;
    save: (settings: StoredSearchEngineSettings) => Promise<void>;
  };
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
};
