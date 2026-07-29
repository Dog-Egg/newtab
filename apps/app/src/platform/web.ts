import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";
import { createWebDefaultBookmarkTree } from "../Launcher/defaultLauncher";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";

const WEB_BOOKMARKS_STORAGE_KEY = "web-bookmarks";
const webBookmarkListeners = new Set<() => void>();
const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

function readJsonStorageValue(key: string) {
  const saved = window.sessionStorage.getItem(key);
  if (saved === null) return undefined;
  try {
    return JSON.parse(saved) as unknown;
  } catch {
    return saved;
  }
}

function writeJsonStorageValue(key: string, value: unknown) {
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function normalizeWebBookmarkNode(value: unknown): BrowserBookmarkNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Partial<BrowserBookmarkNode>;
  if (
    typeof node.id !== "string" ||
    !node.id ||
    typeof node.title !== "string"
  ) {
    return null;
  }

  const common = {
    id: node.id,
    title: node.title,
    parentId: typeof node.parentId === "string" ? node.parentId : undefined,
    index: typeof node.index === "number" ? node.index : undefined,
    unmodifiable:
      node.unmodifiable === "managed" ? ("managed" as const) : undefined,
  };
  if (node.type === "item" && typeof node.url === "string") {
    return { ...common, type: "item", url: node.url };
  }
  if (node.type !== "folder" || !Array.isArray(node.children)) return null;
  return {
    ...common,
    type: "folder",
    folderType: node.folderType,
    children: node.children.flatMap((child) => {
      const normalized = normalizeWebBookmarkNode(child);
      return normalized ? [normalized] : [];
    }),
  };
}

function readStoredWebBookmarks() {
  const value = readJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY);
  if (!Array.isArray(value)) return createWebDefaultBookmarkTree(defaultLocale);
  const tree = value.flatMap((node) => {
    const normalized = normalizeWebBookmarkNode(node);
    return normalized ? [normalized] : [];
  });
  return tree.length > 0 ? tree : createWebDefaultBookmarkTree(defaultLocale);
}

function saveStoredWebBookmarks(tree: BrowserBookmarkNode[]) {
  writeJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY, tree);
  // storage 事件不会回发到当前窗口，主动通知当前预览页面。
  for (const listener of webBookmarkListeners) listener();
}

function mapTree(
  nodes: BrowserBookmarkNode[],
  update: (node: BrowserBookmarkNode) => BrowserBookmarkNode,
): BrowserBookmarkNode[] {
  return nodes.map((node) => {
    const withChildren =
      node.type === "folder"
        ? { ...node, children: mapTree(node.children, update) }
        : node;
    return update(withChildren);
  });
}

function insertIntoFolder(
  nodes: BrowserBookmarkNode[],
  parentId: string,
  inserted: BrowserBookmarkNode,
  requestedIndex?: number,
): BrowserBookmarkNode[] {
  return mapTree(nodes, (node) => {
    if (node.type !== "folder" || node.id !== parentId) return node;
    const index = Math.min(
      Math.max(requestedIndex ?? node.children.length, 0),
      node.children.length,
    );
    const children = [...node.children];
    children.splice(index, 0, { ...inserted, parentId, index });
    return {
      ...node,
      children: children.map((child, childIndex) => ({
        ...child,
        index: childIndex,
      })),
    };
  });
}

function removeFromTree(
  nodes: BrowserBookmarkNode[],
  id: string,
): { tree: BrowserBookmarkNode[]; removed: BrowserBookmarkNode | null } {
  let removed: BrowserBookmarkNode | null = null;
  const tree = nodes.flatMap<BrowserBookmarkNode>((node) => {
    if (node.id === id) {
      removed = node;
      return [];
    }
    if (node.type === "item") return [node];
    const result = removeFromTree(node.children, id);
    if (result.removed) removed = result.removed;
    return [{ ...node, children: result.tree }];
  });
  return { tree, removed };
}

function findNode(
  nodes: BrowserBookmarkNode[],
  id: string,
): BrowserBookmarkNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const child = findNode(node.children, id);
      if (child) return child;
    }
  }
  return null;
}

function readStoredSearchEngineSettings(): StoredSearchEngineSettings {
  const value = readJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY);
  return value && typeof value === "object"
    ? (value as StoredSearchEngineSettings)
    : {};
}

function readStoredSettings() {
  return normalizeSettings(
    readJsonStorageValue(SETTINGS_STORAGE_KEY),
    defaultLocale,
  );
}

export const platform: Platform = {
  defaultLocale,
  bookmarks: {
    read: async () => readStoredWebBookmarks(),
    create: async ({ parentId, title, url, index }) => {
      const node: BrowserBookmarkNode =
        typeof url === "string"
          ? {
              type: "item",
              id: `web-bookmark-${window.crypto.randomUUID()}`,
              title,
              url,
              parentId,
              index,
            }
          : {
              type: "folder",
              id: `web-folder-${window.crypto.randomUUID()}`,
              title,
              parentId,
              index,
              children: [],
            };
      saveStoredWebBookmarks(
        insertIntoFolder(readStoredWebBookmarks(), parentId, node, index),
      );
      return node;
    },
    update: async (id, changes) => {
      const tree = readStoredWebBookmarks();
      const current = findNode(tree, id);
      if (!current) throw new Error(`Web bookmark not found: ${id}`);
      const updated = { ...current, ...changes } as BrowserBookmarkNode;
      saveStoredWebBookmarks(
        mapTree(tree, (node) => (node.id === id ? updated : node)),
      );
      return updated;
    },
    move: async (id, { parentId, index }) => {
      const result = removeFromTree(readStoredWebBookmarks(), id);
      if (!result.removed) throw new Error(`Web bookmark not found: ${id}`);
      const moved = { ...result.removed, parentId, index };
      saveStoredWebBookmarks(
        insertIntoFolder(result.tree, parentId, moved, index),
      );
      return moved;
    },
    remove: async (id) => {
      saveStoredWebBookmarks(removeFromTree(readStoredWebBookmarks(), id).tree);
    },
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === WEB_BOOKMARKS_STORAGE_KEY) onChange();
      };
      webBookmarkListeners.add(onChange);
      window.addEventListener("storage", handleStorageChange);
      return () => {
        webBookmarkListeners.delete(onChange);
        window.removeEventListener("storage", handleStorageChange);
      };
    },
  },
  settings: {
    read: async () => readStoredSettings(),
    save: async (settings: Settings) =>
      writeJsonStorageValue(SETTINGS_STORAGE_KEY, settings),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === SETTINGS_STORAGE_KEY) {
          onChange(readStoredSettings());
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  searchEngineSettings: {
    read: async () => readStoredSearchEngineSettings(),
    save: async (settings) =>
      writeJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY, settings),
  },
};
