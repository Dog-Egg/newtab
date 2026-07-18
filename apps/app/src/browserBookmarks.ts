import {
  type ShortcutFolder,
  type ShortcutItem,
  type ShortcutNode,
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
  normalizeActiveCategoryId,
  type ShortcutCategory,
} from "./Launcher/launcher";
import { toast } from "sonner";
import i18n from "./i18n";
import { normalizeLocale } from "./i18n/locale";
import { normalizeStoredExtensionLauncher } from "./Launcher/defaultLauncher";

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

function getStoredCategories() {
  return new Promise<ShortcutCategory[]>((resolve, reject) => {
    chrome.storage.local.get(LAUNCHER_STORAGE_KEY, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      const locale = normalizeLocale(i18n.resolvedLanguage);
      resolve(
        normalizeStoredExtensionLauncher(items[LAUNCHER_STORAGE_KEY], locale),
      );
    });
  });
}

function getStoredActiveCategoryId() {
  return new Promise<string>((resolve, reject) => {
    chrome.storage.local.get(ACTIVE_CATEGORY_ID_STORAGE_KEY, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      const value = items[ACTIVE_CATEGORY_ID_STORAGE_KEY];
      resolve(typeof value === "string" ? value : DEFAULT_CATEGORY_ID);
    });
  });
}

function setStoredCategories(categories: ShortcutCategory[]) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [LAUNCHER_STORAGE_KEY]: categories }, () => {
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
    return i18n.t("bookmarks.unnamed");
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

  const [categories, storedActiveCategoryId, browserBookmarkTree] =
    await Promise.all([
      getStoredCategories(),
      getStoredActiveCategoryId(),
      getBrowserBookmarkTree(),
    ]);
  const activeCategoryId = normalizeActiveCategoryId(
    storedActiveCategoryId,
    categories,
  );
  const existingShortcuts = categories.flatMap(
    (category) => category.shortcuts,
  );
  const { importedShortcuts, skippedDuplicateCount, folderCount } =
    convertBrowserBookmarkTree(browserBookmarkTree, existingShortcuts);
  const importedCount = countImportedShortcuts(importedShortcuts);

  if (importedShortcuts.length > 0) {
    await setStoredCategories(
      categories.map((category) =>
        category.id === activeCategoryId
          ? {
              ...category,
              shortcuts: [...category.shortcuts, ...importedShortcuts],
            }
          : category,
      ),
    );
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
      toast.error(i18n.t("bookmarks.unavailable"), {
        description: i18n.t("bookmarks.unavailableDescription"),
      });
      return;
    }

    const skippedText =
      result.skippedDuplicateCount > 0
        ? i18n.t("bookmarks.skipped", { count: result.skippedDuplicateCount })
        : "";

    if (result.importedCount === 0) {
      toast.info(
        result.skippedDuplicateCount > 0
          ? i18n.t("bookmarks.noNew", { skipped: skippedText })
          : i18n.t("bookmarks.noneFound"),
      );
      return;
    }

    const folders =
      result.folderCount > 0
        ? i18n.t("bookmarks.folders", { count: result.folderCount })
        : "";
    toast.success(
      i18n.t("bookmarks.imported", {
        count: result.importedCount,
        folders: `${folders}${skippedText}`,
      }),
    );
  } catch {
    toast.error(i18n.t("bookmarks.failed"));
  }
}
