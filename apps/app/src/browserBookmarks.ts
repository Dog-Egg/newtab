import {
  SHORTCUTS_STORAGE_KEY,
  type ShortcutFolder,
  type ShortcutItem,
  type ShortcutNode,
  normalizeShortcuts,
} from "./shortcuts";
import { toast } from "sonner";

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
  folderCount: number;
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
  for (const node of shortcuts) {
    if (node.type === "folder") {
      addExistingUrls(node.children, seenUrls);
    } else {
      seenUrls.add(node.url);
    }
  }
}

function addExistingIds(shortcuts: ShortcutNode[], usedIds: Set<string>) {
  for (const node of shortcuts) {
    usedIds.add(node.id);
    if (node.type === "folder") addExistingIds(node.children, usedIds);
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
    type: "item",
    id: createUniqueId(node.url, context),
    title: getBookmarkTitle(node),
    url: node.url,
    createdAt: node.dateAdded ?? context.createdAtFallback,
  };
}

function convertFolder(
  node: chrome.bookmarks.BookmarkTreeNode,
  context: ImportContext,
): ShortcutFolder[] {
  const children: ShortcutItem[] = [];
  const liftedFolders: ShortcutFolder[] = [];

  for (const child of node.children ?? []) {
    if (child.url) {
      const shortcut = convertBookmarkToShortcut(child, context);
      if (shortcut) {
        children.push(shortcut);
      }
      continue;
    }

    liftedFolders.push(...convertFolder(child, context));
  }

  if (children.length === 0) return liftedFolders;

  context.createdAtFallback += 1;
  context.folderCount += 1;
  return [
    {
      type: "folder",
      id: createUniqueId(`bookmark-folder:${node.id}`, context),
      title: getBookmarkTitle(node),
      children,
      createdAt: node.dateAdded ?? context.createdAtFallback,
    },
    ...liftedFolders,
  ];
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
    folderCount: 0,
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

      importedShortcuts.push(...convertFolder(child, context));
    }
  }

  return {
    importedShortcuts,
    skippedDuplicateCount: context.skippedDuplicateCount,
    folderCount: context.folderCount,
  };
}

function countImportedShortcuts(shortcuts: ShortcutNode[]): number {
  return shortcuts.reduce(
    (count, node) => count + (node.type === "item" ? 1 : node.children.length),
    0,
  );
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
  const { importedShortcuts, skippedDuplicateCount, folderCount } =
    convertBrowserBookmarkTree(browserBookmarkTree, existingShortcuts);
  const importedCount = countImportedShortcuts(importedShortcuts);

  if (importedShortcuts.length > 0) {
    await setStoredShortcuts([...existingShortcuts, ...importedShortcuts]);
  }

  return {
    importedCount,
    skippedDuplicateCount,
    folderCount,
  };
}

export async function importBrowserBookmarksWithToast() {
  try {
    const result = await importBrowserBookmarks();

    if (result.unsupported) {
      toast.error("当前环境无法读取浏览器收藏夹", {
        description: "请在浏览器扩展环境中使用收藏夹导入。",
      });
      return;
    }

    const skippedText =
      result.skippedDuplicateCount > 0
        ? `，跳过 ${result.skippedDuplicateCount} 个重复项`
        : "";

    if (result.importedCount === 0) {
      toast.info(
        result.skippedDuplicateCount > 0
          ? `没有新的可导入收藏${skippedText}`
          : "没有找到可导入的浏览器收藏",
      );
      return;
    }

    toast.success(
      `已导入 ${result.importedCount} 个收藏${
        result.folderCount > 0 ? `，包含 ${result.folderCount} 个文件夹` : ""
      }${skippedText}`,
    );
  } catch {
    toast.error("导入失败，请稍后重试");
  }
}
