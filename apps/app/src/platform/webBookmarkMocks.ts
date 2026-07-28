import type { AppLocale } from "../i18n";
import type {
  BookmarkLayoutCategory,
  BookmarkLayoutNode,
  BrowserBookmark,
  LauncherBookmarkNode,
} from "../Launcher/bookmarkLayout";
import { createWebDefaultBookmarks } from "../Launcher/defaultLauncher";

export type WebBookmarkMocks = {
  layout: BookmarkLayoutCategory[];
  bookmarks: BrowserBookmark[];
};

function toLayoutNode(node: LauncherBookmarkNode): BookmarkLayoutNode {
  return node.type === "item"
    ? { type: "item", id: node.id }
    : {
        type: "folder",
        id: node.id,
        title: node.title,
        children: node.children.map((child) => ({
          type: "item",
          id: child.id,
        })),
      };
}

/**
 * Web 没有 chrome.bookmarks，演示数据拆成两份独立结构：
 * layout 只保存 ID 和嵌套顺序，bookmark entities 保存标题与 URL。
 */
export function createWebBookmarkMocks(locale: AppLocale): WebBookmarkMocks {
  const categories = createWebDefaultBookmarks(locale);
  const bookmarkById = new Map<string, BrowserBookmark>();

  for (const category of categories) {
    for (const node of category.bookmarks) {
      const items = node.type === "item" ? [node] : node.children;
      for (const item of items) {
        bookmarkById.set(item.id, {
          id: item.id,
          title: item.title,
          url: item.url,
        });
      }
    }
  }

  return {
    layout: categories.map(({ id, name, bookmarks }) => ({
      id,
      name,
      bookmarks: bookmarks.map(toLayoutNode),
    })),
    bookmarks: [...bookmarkById.values()],
  };
}
