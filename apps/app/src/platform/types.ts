import type { Settings } from "../settings/schema";
import type { AppLocale } from "../i18n/locale";
import type { BrowserBookmarkNode } from "../launcher/bookmark-tree";
import type { BookmarkUsage } from "../launcher/bookmark-usage";

type StorageUnsubscribe = () => void;

type KeyValueStorage = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown) => Promise<void>;
};

export type Platform = {
  bookmarkUsage: {
    read: () => Promise<BookmarkUsage>;
    record: (bookmarkId: string) => Promise<void>;
  };
  defaultLocale: AppLocale;
  search: {
    browserSearch?: (text: string) => Promise<void>;
  };
  preferencesStorage: KeyValueStorage;
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
  localStorage: KeyValueStorage & {
    subscribe: (key: string, onChange: () => void) => StorageUnsubscribe;
  };
};
