import type {
  ShortcutCategory,
  ShortcutItem,
  ShortcutNode,
} from "../Launcher/launcher";
import { DEFAULT_CATEGORY_ID } from "../Launcher/launcher";
import type { BookmarkItem } from "./bookmarks";

export const OTHER_BOOKMARKS_FOLDER_ID = "other-bookmarks";
export const OTHER_BOOKMARKS_FOLDER_TITLE = "其他";

export type CategoryBookmarkItem = {
  type: "item";
  id: string;
};

export type CategoryBookmarkFolder = {
  type: "folder";
  id: string;
  title: string;
  children: CategoryBookmarkItem[];
};

export type CategoryBookmarkNode =
  CategoryBookmarkItem | CategoryBookmarkFolder;

export type BookmarkCategory = Pick<ShortcutCategory, "id" | "name"> & {
  shortcuts: CategoryBookmarkNode[];
};

function mapShortcutItem(
  shortcut: ShortcutItem,
  bookmarkIdByUrl: ReadonlyMap<string, string>,
): CategoryBookmarkItem | null {
  const bookmarkId = bookmarkIdByUrl.get(shortcut.url);
  // 迁移结果只引用真实存在的 Chrome bookmark ID。
  return bookmarkId === undefined ? null : { type: "item", id: bookmarkId };
}

function mapShortcutNode(
  shortcut: ShortcutNode,
  bookmarkIdByUrl: ReadonlyMap<string, string>,
): CategoryBookmarkNode | null {
  if (shortcut.type === "item") {
    return mapShortcutItem(shortcut, bookmarkIdByUrl);
  }

  // 即使 children 全部未匹配也保留 folder，从而维持 categories 的嵌套骨架。
  return {
    type: "folder",
    id: shortcut.id,
    title: shortcut.title,
    children: shortcut.children.flatMap((child) => {
      const item = mapShortcutItem(child, bookmarkIdByUrl);
      return item ? [item] : [];
    }),
  };
}

function collectShortcutUrls(categories: ShortcutCategory[]): Set<string> {
  const urls = new Set<string>();

  for (const category of categories) {
    for (const shortcut of category.shortcuts) {
      if (shortcut.type === "item") {
        urls.add(shortcut.url);
        continue;
      }

      for (const child of shortcut.children) {
        urls.add(child.url);
      }
    }
  }

  return urls;
}

function addOtherBookmarks(
  shortcuts: CategoryBookmarkNode[],
  otherBookmarks: CategoryBookmarkItem[],
): CategoryBookmarkNode[] {
  if (otherBookmarks.length === 0) return shortcuts;

  const otherFolderIndex = shortcuts.findIndex(
    (shortcut) =>
      shortcut.type === "folder" && shortcut.id === OTHER_BOOKMARKS_FOLDER_ID,
  );

  if (otherFolderIndex === -1) {
    return [
      ...shortcuts,
      {
        type: "folder",
        id: OTHER_BOOKMARKS_FOLDER_ID,
        title: OTHER_BOOKMARKS_FOLDER_TITLE,
        children: otherBookmarks,
      },
    ];
  }

  // 已有“其他”时原地追加，保持它在 default category 中的既有位置。
  return shortcuts.map((shortcut, index) =>
    index === otherFolderIndex && shortcut.type === "folder"
      ? { ...shortcut, children: [...shortcut.children, ...otherBookmarks] }
      : shortcut,
  );
}

export function mapCategoriesToBookmarkNodes(
  categories: ShortcutCategory[],
  bookmarkItems: BookmarkItem[],
): BookmarkCategory[] {
  const bookmarkIdByUrl = new Map<string, string>();
  const shortcutUrls = collectShortcutUrls(categories);

  for (const bookmark of bookmarkItems) {
    // 同一 URL 可能被收藏多次；固定采用树中最先出现的书签，保证结果稳定。
    if (!bookmarkIdByUrl.has(bookmark.url)) {
      bookmarkIdByUrl.set(bookmark.url, bookmark.id);
    }
  }

  // categories 中没有同 URL 快捷方式的 Chrome 书签统一进入“其他”。
  const otherBookmarks = bookmarkItems.flatMap<CategoryBookmarkItem>(
    (bookmark) =>
      shortcutUrls.has(bookmark.url) ? [] : [{ type: "item", id: bookmark.id }],
  );

  // map/flatMap 都按输入顺序产出，category、顶层节点和 folder children 顺序不变。
  return categories.map(({ id, name, shortcuts }) => {
    const mappedShortcuts = shortcuts.flatMap((shortcut) => {
      const node = mapShortcutNode(shortcut, bookmarkIdByUrl);
      return node ? [node] : [];
    });

    return {
      id,
      name,
      shortcuts:
        id === DEFAULT_CATEGORY_ID
          ? addOtherBookmarks(mappedShortcuts, otherBookmarks)
          : mappedShortcuts,
    };
  });
}
