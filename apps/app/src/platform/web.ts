import type { BrowserBookmarkNode } from "../Launcher/bookmarkTree";
import { browserBookmarkTreeSchema } from "../Launcher/schema";
import {
  createWebDefaultBookmarkTree,
  localizeWebDefaultBookmarkTree,
} from "../Launcher/webDefaultBookmarks";
import type { Platform } from "./types";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  searchEngineSettingsSchema,
} from "../SearchEngineBox/schema";
import {
  SETTINGS_STORAGE_KEY,
  settingsSchema,
  type Settings,
} from "../Settings/schema";
import i18n from "../i18n";
import { getLocaleFromLanguage } from "../i18n/locale";

const WEB_BOOKMARKS_STORAGE_KEY = "web-bookmarks";
const webBookmarkListeners = new Set<() => void>();
const defaultLocale = getLocaleFromLanguage(
  new URLSearchParams(window.location.search).get("lang") ?? "en",
);

function parseStoredSettings(value: unknown): Settings {
  const storedSettings = settingsSchema.parse(value);
  return {
    ...storedSettings,
    locale: storedSettings.locale ?? defaultLocale,
  };
}

function notifyWebBookmarkListeners() {
  for (const listener of webBookmarkListeners) listener();
}

i18n.on("languageChanged", notifyWebBookmarkListeners);

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

function readStoredWebBookmarks() {
  const tree = browserBookmarkTreeSchema.parse(
    readJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY),
  );
  return tree.length > 0
    ? localizeWebDefaultBookmarkTree(tree)
    : createWebDefaultBookmarkTree();
}

function saveStoredWebBookmarks(tree: BrowserBookmarkNode[]) {
  writeJsonStorageValue(WEB_BOOKMARKS_STORAGE_KEY, tree);
  // storage 事件不会回发到当前窗口，主动通知当前预览页面。
  notifyWebBookmarkListeners();
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

function readStoredSearchEngineSettings() {
  try {
    return searchEngineSettingsSchema.parse(
      readJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY),
    );
  } catch (error: unknown) {
    console.error("Failed to read search engine settings", error);
    return searchEngineSettingsSchema.parse(undefined);
  }
}

function readStoredSettings() {
  try {
    return parseStoredSettings(readJsonStorageValue(SETTINGS_STORAGE_KEY));
  } catch (error: unknown) {
    console.error("Failed to read settings", error);
    return parseStoredSettings(undefined);
  }
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
