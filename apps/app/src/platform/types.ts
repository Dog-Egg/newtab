import type { Settings } from "../Settings/settings";
import type { AppLocale } from "../i18n/locale";
import type { ShortcutCategory } from "../Launcher/launcher";

export const SEARCH_ENGINE_SETTINGS_KEY = "search-engine-settings";

export type StorageUnsubscribe = () => void;

export type StoredSearchEngineSettings = {
  selectedEngineId?: string;
  hiddenDefaultEngineIds?: string[];
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
  defaultLocale: AppLocale;
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
  settings: {
    read: () => Promise<Settings>;
    save: (settings: Settings) => Promise<void>;
    subscribe: (onChange: (settings: Settings) => void) => StorageUnsubscribe;
  };
  searchEngineSettings: {
    read: () => Promise<StoredSearchEngineSettings>;
    save: (settings: StoredSearchEngineSettings) => Promise<void>;
  };
  browserBookmarks: {
    import: () => Promise<BrowserBookmarksImportResult>;
  };
};
