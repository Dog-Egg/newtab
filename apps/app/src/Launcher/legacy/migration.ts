import type { AppLocale } from "../../i18n";
import { en } from "../../i18n/locales/en";
import { zhCN } from "../../i18n/locales/zh-CN";
import type { BrowserBookmarkItem, BrowserBookmarkNode } from "../bookmarkTree";
import type {
  LegacyLauncherCategory,
  LegacyShortcutItem,
  LegacyShortcutNode,
} from "./schema";
import { LAUNCHER_STORAGE_KEY, normalizeLegacyLauncher } from "./schema";

export const BOOKMARK_TREE_MIGRATION_KEY = "bookmark-tree-migration-completed";
export const LEGACY_LAUNCHER_MIGRATION_LOCK =
  "legacy-launcher-bookmark-migration";

function createEmptyLegacyLauncherCategory(
  locale: AppLocale,
): LegacyLauncherCategory {
  const defaultCategoryNames = (locale === "zh-CN" ? zhCN : en).launcher
    .defaultCategories;
  return {
    id: "default",
    name: defaultCategoryNames.home,
    shortcuts: [],
  };
}

/**
 * 读取旧 Extension 的 launcher 数据；空数据也保持旧结构所需的默认分类。
 * 该函数只服务一次性迁移，不能用于当前 Bookmark Launcher。
 */
export function normalizeStoredExtensionLauncher(
  value: unknown,
  locale: AppLocale,
) {
  return normalizeLegacyLauncher(
    value,
    createEmptyLegacyLauncherCategory(locale),
  );
}

function isWebUrl(url: string) {
  try {
    const protocol = new URL(url).protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 找出旧 Launcher 中尚未进入浏览器的数据，供 Extension 创建为真实书签。
 * 按 URL 去重，与旧版本“将快捷方式导出到浏览器”的行为保持一致。
 */
export function collectLegacyBookmarksToExport(
  categories: LegacyLauncherCategory[],
  browserBookmarks: Pick<BrowserBookmarkItem, "id" | "title" | "url">[],
): LegacyShortcutItem[] {
  const seenUrls = new Set(browserBookmarks.map((bookmark) => bookmark.url));
  const bookmarksToCreate: LegacyShortcutItem[] = [];

  const collectNode = (node: LegacyShortcutNode) => {
    const items = node.type === "item" ? [node] : node.children;
    for (const item of items) {
      if (!isWebUrl(item.url) || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      bookmarksToCreate.push(item);
    }
  };

  for (const category of categories) {
    for (const node of category.shortcuts) collectNode(node);
  }

  return bookmarksToCreate;
}

type LegacyLauncherMigrationDependencies = {
  locale: AppLocale;
  readStorage: (keys: string[]) => Promise<Record<string, unknown>>;
  writeStorage: (key: string, value: unknown) => Promise<void>;
  readBookmarks: () => Promise<BrowserBookmarkNode[]>;
  createBookmark: (bookmark: {
    parentId?: string;
    title: string;
    url?: string;
  }) => Promise<{ id: string }>;
};

/**
 * 将尚未进入浏览器的旧快捷方式导出到一个真实书签文件夹。
 * 完成后只写迁移标记，绝不修改或删除旧 `launcher` 数据。
 */
export async function migrateLegacyLauncherOnce({
  locale,
  readStorage,
  writeStorage,
  readBookmarks,
  createBookmark,
}: LegacyLauncherMigrationDependencies) {
  const items = await readStorage([
    BOOKMARK_TREE_MIGRATION_KEY,
    LAUNCHER_STORAGE_KEY,
  ]);
  if (items[BOOKMARK_TREE_MIGRATION_KEY] === true) return;

  const legacyCategories = normalizeStoredExtensionLauncher(
    items[LAUNCHER_STORAGE_KEY],
    locale,
  );
  const browserItems = (await readBookmarks()).flatMap(
    function collect(node): BrowserBookmarkItem[] {
      if (node.type === "item") return [node];
      return node.children.flatMap(collect);
    },
  );
  const bookmarksToExport = collectLegacyBookmarksToExport(
    legacyCategories,
    browserItems,
  );

  if (bookmarksToExport.length > 0) {
    const folder = await createBookmark({ title: "NewTab" });
    for (const bookmark of bookmarksToExport) {
      await createBookmark({
        parentId: folder.id,
        title: bookmark.title,
        url: bookmark.url,
      });
    }
  }

  await writeStorage(BOOKMARK_TREE_MIGRATION_KEY, true);
}
