import {
  SHORTCUTS_STORAGE_KEY,
  type ShortcutItem,
  type ShortcutNode,
  normalizeShortcuts,
} from "./shortcuts";

export type BrowserBookmarksImportResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  folderCount: number;
  unsupported?: boolean;
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

function getStoredShortcuts() {
  return new Promise<ShortcutNode[]>((resolve, reject) => {
    chrome.storage.local.get(SHORTCUTS_STORAGE_KEY, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(normalizeShortcuts(items[SHORTCUTS_STORAGE_KEY]));
    });
  });
}

function setStoredShortcuts(shortcuts: ShortcutNode[]) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [SHORTCUTS_STORAGE_KEY]: shortcuts }, () => {
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

function addExistingUrls(shortcuts: ShortcutNode[], seenUrls: Set<string>) {
  for (const shortcut of shortcuts) {
    seenUrls.add(shortcut.url);
  }
}

function addExistingIds(shortcuts: ShortcutNode[], usedIds: Set<string>) {
  for (const shortcut of shortcuts) {
    usedIds.add(shortcut.id);
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

function convertBookmarkToShortcut(
  node: chrome.bookmarks.BookmarkTreeNode,
  context: ImportContext,
): ShortcutItem | null {
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
    id: createUniqueId(node.url, context),
    title: getBookmarkTitle(node),
    url: node.url,
    createdAt: node.dateAdded ?? context.createdAtFallback,
  };
}

function convertFolder(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  context: ImportContext,
): ShortcutNode[] {
  const nextPath = node.title.trim() ? [...path, node.title.trim()] : path;
  const shortcuts: ShortcutNode[] = [];

  for (const child of node.children ?? []) {
    if (child.url) {
      const shortcut = convertBookmarkToShortcut(child, context);
      if (shortcut) {
        shortcuts.push(shortcut);
      }
      continue;
    }

    shortcuts.push(...convertFolder(child, nextPath, context));
  }

  return shortcuts;
}

function convertBrowserBookmarkTree(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  existingShortcuts: ShortcutNode[],
) {
  const context: ImportContext = {
    createdAtFallback: Date.now(),
    usedIds: new Set<string>(),
    seenUrls: new Set<string>(),
    skippedDuplicateCount: 0,
  };
  const importedShortcuts: ShortcutNode[] = [];

  addExistingUrls(existingShortcuts, context.seenUrls);
  addExistingIds(existingShortcuts, context.usedIds);

  for (const root of tree) {
    for (const child of root.children ?? []) {
      if (child.url) {
        const shortcut = convertBookmarkToShortcut(child, context);
        if (shortcut) {
          importedShortcuts.push(shortcut);
        }
        continue;
      }

      importedShortcuts.push(...convertFolder(child, [], context));
    }
  }

  return {
    importedShortcuts,
    skippedDuplicateCount: context.skippedDuplicateCount,
  };
}

function countImportedShortcuts(shortcuts: ShortcutNode[]) {
  return shortcuts.length;
}

export async function importBrowserBookmarks(): Promise<BrowserBookmarksImportResult> {
  if (!canUseChromeBookmarks()) {
    return {
      importedCount: 0,
      skippedDuplicateCount: 0,
      folderCount: 0,
      unsupported: true,
    };
  }

  const [existingShortcuts, browserBookmarkTree] = await Promise.all([
    getStoredShortcuts(),
    getBrowserBookmarkTree(),
  ]);
  const { importedShortcuts, skippedDuplicateCount } =
    convertBrowserBookmarkTree(browserBookmarkTree, existingShortcuts);
  const importedCount = countImportedShortcuts(importedShortcuts);

  if (importedShortcuts.length > 0) {
    await setStoredShortcuts([...existingShortcuts, ...importedShortcuts]);
  }

  return {
    importedCount,
    skippedDuplicateCount,
    folderCount: 0,
  };
}
