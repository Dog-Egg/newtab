import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";

/**
 * 应用层的 index 表示节点移动完成后的最终位置；Chromium 的底层 Move
 * 在同一目录向后移动时，仍按移除节点前的 children 计算插入点。
 */
export function toChromeMoveDestination(
  node: Pick<chrome.bookmarks.BookmarkTreeNode, "parentId" | "index">,
  destination: chrome.bookmarks.MoveDestination,
): chrome.bookmarks.MoveDestination {
  const destinationParentId = destination.parentId ?? node.parentId;
  const destinationIndex = destination.index;
  if (
    typeof destinationIndex !== "number" ||
    typeof node.index !== "number" ||
    destinationParentId !== node.parentId ||
    destinationIndex <= node.index
  ) {
    return destination;
  }

  return {
    ...destination,
    // 向后移动时补偿源节点被移除后产生的一位偏移，否则相邻交换会变成原地移动。
    index: destinationIndex + 1,
  };
}

/** 将 Chrome API 节点转换成应用统一使用的显式联合类型。 */
export function toBrowserBookmarkNode(
  node: chrome.bookmarks.BookmarkTreeNode,
): BrowserBookmarkNode {
  const common = {
    id: node.id,
    title: node.title,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    ...(typeof node.index === "number" ? { index: node.index } : {}),
    ...(node.unmodifiable ? { unmodifiable: node.unmodifiable } : {}),
  };

  if (typeof node.url === "string") {
    return { ...common, type: "item", url: node.url };
  }

  return {
    ...common,
    type: "folder",
    ...(node.folderType ? { folderType: node.folderType } : {}),
    children: (node.children ?? []).map(toBrowserBookmarkNode),
  };
}

export function getBookmarkTree(): Promise<BrowserBookmarkNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      // lastError 只能在 Chrome API 回调执行期间读取。
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tree.map(toBrowserBookmarkNode));
    });
  });
}
