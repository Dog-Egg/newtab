import {
  BOOKMARKS_STORAGE_KEY,
  type BookmarkFolder,
  type BookmarkItem,
  type BookmarkNode,
  normalizeBookmarks,
} from "./bookmarks";

export type BrowserBookmarksImportResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  folderCount: number;
};

type ImportContext = {
  createdAtFallback: number;
  usedIds: Set<string>;
  seenUrls: Set<string>;
  skippedDuplicateCount: number;
};

export function canUseChromeBookmarks() {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.bookmarks !== "undefined" &&
    typeof chrome.bookmarks.getTree === "function" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

function isWebUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function getStoredBookmarks() {
  return new Promise<BookmarkNode[]>((resolve, reject) => {
    chrome.storage.local.get(BOOKMARKS_STORAGE_KEY, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(normalizeBookmarks(items[BOOKMARKS_STORAGE_KEY]));
    });
  });
}

function setStoredBookmarks(bookmarks: BookmarkNode[]) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: bookmarks }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function getBrowserBookmarkTree() {
  return new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tree);
    });
  });
}

function addExistingUrls(bookmarks: BookmarkNode[], seenUrls: Set<string>) {
  for (const bookmark of bookmarks) {
    if (bookmark.type === "bookmark") {
      seenUrls.add(bookmark.url);
      continue;
    }

    for (const child of bookmark.children) {
      seenUrls.add(child.url);
    }
  }
}

function addExistingIds(bookmarks: BookmarkNode[], usedIds: Set<string>) {
  for (const bookmark of bookmarks) {
    usedIds.add(bookmark.id);

    if (bookmark.type === "folder") {
      for (const child of bookmark.children) {
        usedIds.add(child.id);
      }
    }
  }
}

function createUniqueId(baseId: string, context: ImportContext) {
  if (!context.usedIds.has(baseId)) {
    context.usedIds.add(baseId);
    return baseId;
  }

  let index = 2;
  let nextId = `${baseId}-${index}`;

  while (context.usedIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }

  context.usedIds.add(nextId);
  return nextId;
}

function getBookmarkTitle(node: chrome.bookmarks.BookmarkTreeNode) {
  const title = node.title.trim();
  if (title) {
    return title;
  }

  if (!node.url) {
    return "未命名";
  }

  try {
    return new URL(node.url).hostname;
  } catch {
    return node.url;
  }
}

function convertBookmarkItem(
  node: chrome.bookmarks.BookmarkTreeNode,
  context: ImportContext,
): BookmarkItem | null {
  if (!node.url || !isWebUrl(node.url)) {
    return null;
  }

  if (context.seenUrls.has(node.url)) {
    context.skippedDuplicateCount += 1;
    return null;
  }

  context.seenUrls.add(node.url);
  context.createdAtFallback += 1;

  return {
    type: "bookmark",
    id: createUniqueId(node.url, context),
    title: getBookmarkTitle(node),
    url: node.url,
    createdAt: node.dateAdded ?? context.createdAtFallback,
  };
}

function getFolderTitle(path: string[]) {
  return path
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

function convertFolder(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  context: ImportContext,
): BookmarkNode[] {
  const title = node.title.trim();
  const nextPath = title ? [...path, title] : path;
  const directBookmarks: BookmarkItem[] = [];
  const nestedNodes: BookmarkNode[] = [];

  for (const child of node.children ?? []) {
    if (child.url) {
      const bookmark = convertBookmarkItem(child, context);
      if (bookmark) {
        directBookmarks.push(bookmark);
      }
      continue;
    }

    nestedNodes.push(...convertFolder(child, nextPath, context));
  }

  const folderTitle = getFolderTitle(nextPath);
  const folderNodes =
    directBookmarks.length > 0 && folderTitle
      ? [
          {
            type: "folder",
            id: createUniqueId(`browser-folder-${node.id}`, context),
            title: folderTitle,
            createdAt: node.dateAdded ?? Date.now(),
            children: directBookmarks,
          } satisfies BookmarkFolder,
        ]
      : [];

  return [...folderNodes, ...nestedNodes];
}

function convertBrowserBookmarkTree(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  existingBookmarks: BookmarkNode[],
) {
  const context: ImportContext = {
    createdAtFallback: Date.now(),
    usedIds: new Set<string>(),
    seenUrls: new Set<string>(),
    skippedDuplicateCount: 0,
  };
  const importedBookmarks: BookmarkNode[] = [];

  addExistingUrls(existingBookmarks, context.seenUrls);
  addExistingIds(existingBookmarks, context.usedIds);

  for (const root of tree) {
    for (const child of root.children ?? []) {
      if (child.url) {
        const bookmark = convertBookmarkItem(child, context);
        if (bookmark) {
          importedBookmarks.push(bookmark);
        }
        continue;
      }

      importedBookmarks.push(...convertFolder(child, [], context));
    }
  }

  return {
    importedBookmarks,
    skippedDuplicateCount: context.skippedDuplicateCount,
  };
}

function countImportedBookmarks(bookmarks: BookmarkNode[]) {
  return bookmarks.reduce(
    (total, bookmark) =>
      total + (bookmark.type === "bookmark" ? 1 : bookmark.children.length),
    0,
  );
}

export async function importBrowserBookmarks(): Promise<BrowserBookmarksImportResult> {
  if (!canUseChromeBookmarks()) {
    throw new Error("browser-bookmarks-unavailable");
  }

  const [existingBookmarks, browserBookmarkTree] = await Promise.all([
    getStoredBookmarks(),
    getBrowserBookmarkTree(),
  ]);
  const { importedBookmarks, skippedDuplicateCount } =
    convertBrowserBookmarkTree(browserBookmarkTree, existingBookmarks);
  const importedCount = countImportedBookmarks(importedBookmarks);

  if (importedBookmarks.length > 0) {
    await setStoredBookmarks([...existingBookmarks, ...importedBookmarks]);
  }

  return {
    importedCount,
    skippedDuplicateCount,
    folderCount: importedBookmarks.filter(
      (bookmark) => bookmark.type === "folder",
    ).length,
  };
}
