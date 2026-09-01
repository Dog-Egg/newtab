import type {
  BrowserBookmarkItem,
  BrowserBookmarkNode,
} from "../../Launcher/bookmarkTree";
import type {
  LegacyLauncherCategory,
  LegacyShortcutItem,
  LegacyShortcutNode,
} from "./legacyLauncher";
import { LAUNCHER_STORAGE_KEY, legacyLauncherSchema } from "./legacyLauncher";

class ShortcutMigrationRollbackError extends Error {
  constructor(
    readonly migrationError: unknown,
    readonly cleanupError: unknown,
  ) {
    super("Failed to migrate shortcuts and remove the incomplete folder");
    this.name = "ShortcutMigrationRollbackError";
  }
}

function normalizeWebUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:"
      ? parsedUrl.href
      : null;
  } catch {
    return null;
  }
}

/**
 * 找出旧 Launcher 中尚未进入浏览器的数据，供 Extension 创建为真实书签。
 * 按 URL 去重，与旧版本“将快捷方式导出到浏览器”的行为保持一致。
 */
export function collectLegacyShortcutsToExport(
  categories: LegacyLauncherCategory[],
  browserBookmarks: Pick<BrowserBookmarkItem, "id" | "title" | "url">[],
): LegacyShortcutItem[] {
  const seenUrls = new Set(
    browserBookmarks.flatMap((bookmark) => {
      const normalizedUrl = normalizeWebUrl(bookmark.url);
      return normalizedUrl ? [normalizedUrl] : [];
    }),
  );
  const bookmarksToCreate: LegacyShortcutItem[] = [];

  const collectNode = (node: LegacyShortcutNode) => {
    const items = node.type === "item" ? [node] : node.children;
    for (const item of items) {
      const normalizedUrl = normalizeWebUrl(item.url);
      if (!normalizedUrl || seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);
      bookmarksToCreate.push(item);
    }
  };

  for (const category of categories) {
    for (const node of category.shortcuts) collectNode(node);
  }

  return bookmarksToCreate;
}

type LegacyLauncherMigrationDependencies = {
  readStorage: (keys: string[]) => Promise<Record<string, unknown>>;
  removeStorage: (key: string) => Promise<void>;
  readBookmarks: () => Promise<BrowserBookmarkNode[]>;
  createBookmark: (bookmark: {
    parentId?: string;
    title: string;
    url?: string;
  }) => Promise<{ id: string }>;
  removeBookmarkFolder: (id: string) => Promise<void>;
};

/**
 * 将尚未进入浏览器的旧快捷方式导出到一个真实书签文件夹。
 * 仅在旧 `launcher` 数据存在时执行，成功后删除旧数据。
 */
export async function migrateLegacyShortcutsOnce({
  readStorage,
  removeStorage,
  readBookmarks,
  createBookmark,
  removeBookmarkFolder,
}: LegacyLauncherMigrationDependencies) {
  const items = await readStorage([LAUNCHER_STORAGE_KEY]);
  if (!Object.prototype.hasOwnProperty.call(items, LAUNCHER_STORAGE_KEY))
    return;

  const legacyCategories = legacyLauncherSchema.parse(
    items[LAUNCHER_STORAGE_KEY],
  );
  const browserItems = (await readBookmarks()).flatMap(
    function collect(node): BrowserBookmarkItem[] {
      if (node.type === "item") return [node];
      return node.children.flatMap(collect);
    },
  );
  const bookmarksToExport = collectLegacyShortcutsToExport(
    legacyCategories,
    browserItems,
  );

  if (bookmarksToExport.length > 0) {
    const folder = await createBookmark({ title: "NewTab" });
    try {
      for (const bookmark of bookmarksToExport) {
        await createBookmark({
          parentId: folder.id,
          title: bookmark.title,
          url: bookmark.url,
        });
      }
    } catch (error) {
      try {
        await removeBookmarkFolder(folder.id);
      } catch (cleanupError) {
        throw new ShortcutMigrationRollbackError(error, cleanupError);
      }
      throw error;
    }
  }

  await removeStorage(LAUNCHER_STORAGE_KEY);
}
