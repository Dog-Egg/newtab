import type { BrowserBookmarkItem } from "../bookmarkTree";
import type {
  LegacyLauncherCategory,
  LegacyShortcutItem,
  LegacyShortcutNode,
} from "../legacyLauncher";

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
