import type { AppLocale } from "../i18n";
import type {
  BookmarkLayoutCategory,
  BookmarkLayoutNode,
  BrowserBookmark,
} from "../Launcher/bookmarkLayout";
import { createWebDefaultLauncher } from "../Launcher/defaultLauncher";
import type { ShortcutNode } from "../Launcher/launcher";

export type WebBookmarkMocks = {
  layout: BookmarkLayoutCategory[];
  bookmarks: BrowserBookmark[];
};

function toLayoutNode(node: ShortcutNode): BookmarkLayoutNode {
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
 * Web 没有 chrome.bookmarks，复用原 Web 演示内容生成两份独立数据：
 * layout 只保存 ID 和嵌套顺序，bookmark 实体保存标题与 URL。
 */
export function createWebBookmarkMocks(locale: AppLocale): WebBookmarkMocks {
  const categories = createWebDefaultLauncher(locale);
  const bookmarkById = new Map<string, BrowserBookmark>();

  for (const category of categories) {
    for (const node of category.shortcuts) {
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
    layout: categories.map(({ id, name, shortcuts }) => ({
      id,
      name,
      bookmarks: shortcuts.map(toLayoutNode),
    })),
    bookmarks: [...bookmarkById.values()],
  };
}
