import type { LauncherSettings } from "../Launcher/launcherSettings";
import type { ShortcutCategory } from "../Launcher/launcher";

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
  launcher: {
    read: () => Promise<ShortcutCategory[]>;
    save: (categories: ShortcutCategory[]) => Promise<void>;
    subscribe: (
      onChange: (categories: ShortcutCategory[]) => void,
    ) => StorageUnsubscribe;
  };
  activeCategoryId: {
    read: () => Promise<string>;
    save: (categoryId: string) => Promise<void>;
    subscribe: (onChange: (categoryId: string) => void) => StorageUnsubscribe;
  };
  wallpaper: {
    read: () => Promise<string | null>;
    save: (wallpaperUrl: string | null) => Promise<void>;
    subscribe: (
      onChange: (wallpaperUrl: string | null) => void,
    ) => StorageUnsubscribe;
  };
  launcherSettings: {
    read: () => Promise<LauncherSettings>;
    save: (settings: LauncherSettings) => Promise<void>;
    subscribe: (
      onChange: (settings: LauncherSettings) => void,
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
