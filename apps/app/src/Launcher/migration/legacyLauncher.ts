import type {
  BookmarkLayoutCategory,
  BookmarkLayoutFolder,
  BookmarkLayoutItem,
  BookmarkLayoutNode,
  BrowserBookmark,
} from "../bookmarkLayout";
import {
  DEFAULT_CATEGORY_ID,
  type ShortcutCategory,
  type ShortcutItem,
  type ShortcutNode,
} from "../launcher";

export const MIGRATED_OTHER_BOOKMARKS_FOLDER_ID = "migration-other-bookmarks";

function isWebUrl(url: string) {
  try {
    const protocol = new URL(url).protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 找出旧 Launcher 独有的快捷方式，供 Extension 在生成新布局前导出为真实
 * Chrome Bookmark。按 URL 去重，与旧的手动导出功能保持一致。
 */
export function collectLegacyShortcutsToExport(
  categories: ShortcutCategory[],
  browserBookmarks: BrowserBookmark[],
): ShortcutItem[] {
  const seenUrls = new Set(browserBookmarks.map((bookmark) => bookmark.url));
  const shortcuts: ShortcutItem[] = [];

  const collectNode = (node: ShortcutNode) => {
    const items = node.type === "item" ? [node] : node.children;
    for (const item of items) {
      if (!isWebUrl(item.url) || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      shortcuts.push(item);
    }
  };

  for (const category of categories) {
    for (const node of category.shortcuts) collectNode(node);
  }

  return shortcuts;
}

/**
 * 将旧 Launcher 的完整 Shortcut 数据转换成只引用 Chrome Bookmark ID 的布局。
 * 重复 URL 只保留第一次出现的位置，避免同一个 Bookmark ID 被多个布局节点引用。
 */
export function migrateLegacyLauncherToBookmarkLayout(
  categories: ShortcutCategory[],
  browserBookmarks: BrowserBookmark[],
  otherBookmarksFolderTitle: string,
): BookmarkLayoutCategory[] {
  const bookmarkIdByUrl = new Map<string, string>();
  const migratedBookmarkIds = new Set<string>();
  const migratedUrls = new Set<string>();

  for (const bookmark of browserBookmarks) {
    // Chrome 中同一 URL 可能收藏多次；使用树中最先出现的书签保证迁移结果稳定。
    if (!bookmarkIdByUrl.has(bookmark.url)) {
      bookmarkIdByUrl.set(bookmark.url, bookmark.id);
    }
  }

  const migrateItem = (item: ShortcutItem): BookmarkLayoutItem | null => {
    if (migratedUrls.has(item.url)) return null;
    migratedUrls.add(item.url);

    const bookmarkId = bookmarkIdByUrl.get(item.url);
    if (!bookmarkId) return null;

    migratedBookmarkIds.add(bookmarkId);
    return { type: "item", id: bookmarkId };
  };

  const migrateNode = (node: ShortcutNode): BookmarkLayoutNode | null => {
    if (node.type === "item") return migrateItem(node);

    // 即使子项全部无效也保留 Folder，确保旧 Launcher 的分类骨架不被破坏。
    return {
      type: "folder",
      id: node.id,
      title: node.title,
      children: node.children.flatMap((item) => {
        const migrated = migrateItem(item);
        return migrated ? [migrated] : [];
      }),
    };
  };

  const migratedCategories = categories.map(({ id, name, shortcuts }) => ({
    id,
    name,
    bookmarks: shortcuts.flatMap((node) => {
      const migrated = migrateNode(node);
      return migrated ? [migrated] : [];
    }),
  }));

  const otherBookmarks = browserBookmarks.flatMap<BookmarkLayoutItem>(
    (bookmark) =>
      migratedBookmarkIds.has(bookmark.id)
        ? []
        : [{ type: "item", id: bookmark.id }],
  );
  if (otherBookmarks.length === 0) return migratedCategories;

  // Folder ID 同样参与拖拽分组；如果旧数据恰好占用了保留 ID，就稳定地递增后缀。
  const usedNodeIds = new Set(
    migratedCategories.flatMap((category) =>
      category.bookmarks.map((node) => node.id),
    ),
  );
  let otherFolderId = MIGRATED_OTHER_BOOKMARKS_FOLDER_ID;
  let suffix = 2;
  while (usedNodeIds.has(otherFolderId)) {
    otherFolderId = `${MIGRATED_OTHER_BOOKMARKS_FOLDER_ID}-${suffix}`;
    suffix += 1;
  }

  const otherFolder: BookmarkLayoutFolder = {
    type: "folder",
    id: otherFolderId,
    title: otherBookmarksFolderTitle,
    children: otherBookmarks,
  };

  // “其他”只属于迁移快照，并固定为 default category 的最后一个节点。
  return migratedCategories.map((category) =>
    category.id === DEFAULT_CATEGORY_ID
      ? { ...category, bookmarks: [...category.bookmarks, otherFolder] }
      : category,
  );
}
