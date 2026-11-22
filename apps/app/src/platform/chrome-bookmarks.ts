import type { BrowserBookmarkNode } from "../bookmarks/bookmark-tree";
import type { Platform } from "./types";

function getBookmarkError() {
  const error = chrome.runtime.lastError;
  return error ? new Error(error.message) : null;
}

function createChromeBookmarkNode(
  details: chrome.bookmarks.CreateDetails,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(details, (bookmark) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve(bookmark);
    });
  });
}

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

function updateBookmark(
  id: string,
  changes: chrome.bookmarks.UpdateChanges,
): Promise<BrowserBookmarkNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, changes, (bookmark) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve(toBrowserBookmarkNode(bookmark));
    });
  });
}

async function moveBookmark(
  id: string,
  destination: chrome.bookmarks.MoveDestination,
): Promise<BrowserBookmarkNode> {
  const current = await getChromeBookmark(id);
  const chromeDestination = toChromeMoveDestination(current, destination);

  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(id, chromeDestination, (bookmark) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve(toBrowserBookmarkNode(bookmark));
    });
  });
}

function getChromeBookmark(id: string) {
  return new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
    chrome.bookmarks.get(id, (nodes) => {
      const error = getBookmarkError();
      if (error) reject(error);
      else if (!nodes[0]) reject(new Error(`Bookmark not found: ${id}`));
      else resolve(nodes[0]);
    });
  });
}

async function removeBookmark(id: string): Promise<void> {
  const bookmark = await getChromeBookmark(id);
  return new Promise((resolve, reject) => {
    const done = () => {
      const error = getBookmarkError();
      if (error) reject(error);
      else resolve();
    };
    // 文件夹可能包含任意深度的后代，必须使用 removeTree。
    if (bookmark.url) chrome.bookmarks.remove(id, done);
    else chrome.bookmarks.removeTree(id, done);
  });
}

function subscribeBookmarks(onChange: () => void) {
  chrome.bookmarks.onCreated.addListener(onChange);
  chrome.bookmarks.onChanged.addListener(onChange);
  chrome.bookmarks.onMoved.addListener(onChange);
  chrome.bookmarks.onRemoved.addListener(onChange);
  chrome.bookmarks.onChildrenReordered.addListener(onChange);
  chrome.bookmarks.onImportEnded.addListener(onChange);
  return () => {
    chrome.bookmarks.onCreated.removeListener(onChange);
    chrome.bookmarks.onChanged.removeListener(onChange);
    chrome.bookmarks.onMoved.removeListener(onChange);
    chrome.bookmarks.onRemoved.removeListener(onChange);
    chrome.bookmarks.onChildrenReordered.removeListener(onChange);
    chrome.bookmarks.onImportEnded.removeListener(onChange);
  };
}

export const chromeBookmarks: Platform["bookmarks"] = {
  read: getBookmarkTree,
  create: async (bookmark) =>
    toBrowserBookmarkNode(await createChromeBookmarkNode(bookmark)),
  update: updateBookmark,
  move: moveBookmark,
  remove: removeBookmark,
  subscribe: subscribeBookmarks,
};
