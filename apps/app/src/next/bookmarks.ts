export type BookmarkItem = chrome.bookmarks.BookmarkTreeNode & {
  url: string;
};

// Chrome 用 url 区分书签与目录：目录节点没有 url。
function isBookmarkItem(
  node: chrome.bookmarks.BookmarkTreeNode,
): node is BookmarkItem {
  return typeof node.url === "string";
}

/**
 * 按 Chrome 书签树原有的先序顺序展开所有 item。
 * 使用显式栈避免书签目录过深时递归调用栈溢出。
 */
export function flattenBookmarkItems(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): BookmarkItem[] {
  const items: BookmarkItem[] = [];
  // 逆序入栈、正序出栈，确保同级书签的展示顺序不变。
  const pending = [...nodes].reverse();

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;

    if (isBookmarkItem(node)) {
      items.push(node);
    }

    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index--) {
      pending.push(node.children![index]);
    }
  }

  return items;
}

export function getAllBookmarkItems(): Promise<BookmarkItem[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      // lastError 只能在 Chrome API 回调执行期间读取。
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(flattenBookmarkItems(tree));
    });
  });
}
