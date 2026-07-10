import type { ShortcutNode } from "../shortcuts";

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
  shortcuts: {
    read: () => Promise<ShortcutNode[]>;
    save: (shortcuts: ShortcutNode[]) => Promise<void>;
    subscribe: (
      onChange: (shortcuts: ShortcutNode[]) => void,
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
