import type { BookmarkNode } from "../bookmarks";

export type StorageUnsubscribe = () => void;

export type StoredSearchEngineSettings = {
  selectedEngineId?: string;
  customEngines?: Array<{
    id: string;
    name: string;
    urlFormat: string;
  }>;
};

export type BrowserBookmarksImportResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  folderCount: number;
  unsupported?: boolean;
};

export type Platform = {
  bookmarks: {
    read: () => Promise<BookmarkNode[]>;
    save: (bookmarks: BookmarkNode[]) => Promise<void>;
    subscribe: (
      onChange: (bookmarks: BookmarkNode[]) => void,
    ) => StorageUnsubscribe;
  };
  wallpaper: {
    read: () => Promise<string | null>;
    save: (wallpaperUrl: string | null) => Promise<void>;
    subscribe: (
      onChange: (wallpaperUrl: string | null) => void,
    ) => StorageUnsubscribe;
  };
  searchEngineSettings: {
    read: () => Promise<StoredSearchEngineSettings>;
    save: (settings: StoredSearchEngineSettings) => Promise<void>;
  };
  browserBookmarks: {
    import: () => Promise<BrowserBookmarksImportResult>;
  };
};
