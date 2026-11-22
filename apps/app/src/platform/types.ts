import type { AppLocale } from "../i18n/locale";
import type { BrowserBookmarkNode } from "../bookmarks/bookmark-tree";

type StorageUnsubscribe = () => void;

type KeyValueStorage = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown) => Promise<void>;
  subscribe: (
    key: string,
    onChange: (value: unknown) => void,
  ) => StorageUnsubscribe;
};

export type Platform = {
  bookmarkUsage: {
    read: () => Promise<unknown>;
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
  localStorage: KeyValueStorage;
};
