import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOKMARK_LAYOUT_STORAGE_KEY } from "../Launcher/bookmarkLayout";
import { MIGRATED_OTHER_BOOKMARKS_FOLDER_ID } from "../Launcher/migration/legacyLauncher";
import {
  DEFAULT_CATEGORY_ID,
  LAUNCHER_STORAGE_KEY,
  type ShortcutCategory,
} from "../Launcher/launcher";

const legacyCategories: ShortcutCategory[] = [
  {
    id: DEFAULT_CATEGORY_ID,
    name: "Home",
    shortcuts: [
      {
        type: "item",
        id: "old-docs",
        title: "Docs",
        url: "https://docs.example",
        createdAt: 1,
      },
      {
        type: "item",
        id: "old-new",
        title: "New",
        url: "https://new.example",
        createdAt: 2,
      },
    ],
  },
];

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

function createChromeMock(
  storedItems: Record<string, unknown>,
  bookmarkTrees: chrome.bookmarks.BookmarkTreeNode[][],
) {
  let treeIndex = 0;
  const create = vi.fn(
    (
      details: chrome.bookmarks.CreateDetails,
      callback: (bookmark: chrome.bookmarks.BookmarkTreeNode) => void,
    ) => {
      callback({
        id: details.url ? "bookmark-new" : "new-tab-folder",
        title: details.title ?? "",
        ...(details.url ? { url: details.url } : {}),
        syncing: false,
      });
    },
  );
  const getTree = vi.fn(
    (callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
      callback(bookmarkTrees[Math.min(treeIndex, bookmarkTrees.length - 1)]);
      treeIndex += 1;
    },
  );

  vi.stubGlobal("chrome", {
    i18n: { getUILanguage: () => "en" },
    runtime: {},
    storage: {
      local: {
        get: (
          _keys: string | string[],
          callback: (items: Record<string, unknown>) => void,
        ) => callback(storedItems),
        set: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    bookmarks: {
      getTree,
      create,
      update: vi.fn(),
      remove: vi.fn(),
      onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });

  return { create, getTree };
}

describe("extension bookmark layout migration", () => {
  it("uses an existing bookmark-layout without reading or exporting bookmarks", async () => {
    const storedLayout = [
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Saved",
        bookmarks: [{ type: "item" as const, id: "bookmark-saved" }],
      },
    ];
    const chromeMock = createChromeMock(
      {
        [BOOKMARK_LAYOUT_STORAGE_KEY]: storedLayout,
        [LAUNCHER_STORAGE_KEY]: legacyCategories,
      },
      [[]],
    );
    const { platform } = await import("./extension");

    await expect(platform.bookmarkLayout.read("en")).resolves.toEqual(
      storedLayout,
    );
    expect(chromeMock.getTree).not.toHaveBeenCalled();
    expect(chromeMock.create).not.toHaveBeenCalled();
  });

  it("exports missing legacy shortcuts and returns the migrated layout in memory", async () => {
    const beforeExport: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: "root",
        title: "",
        syncing: false,
        children: [
          {
            id: "bookmark-docs",
            title: "Docs in Chrome",
            url: "https://docs.example",
            syncing: false,
          },
          {
            id: "bookmark-extra",
            title: "Extra",
            url: "https://extra.example",
            syncing: false,
          },
        ],
      },
    ];
    const afterExport: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        ...beforeExport[0],
        children: [
          ...beforeExport[0].children!,
          {
            id: "bookmark-new",
            title: "New",
            url: "https://new.example",
            syncing: false,
          },
        ],
      },
    ];
    const chromeMock = createChromeMock(
      { [LAUNCHER_STORAGE_KEY]: legacyCategories },
      [beforeExport, afterExport],
    );
    const { platform } = await import("./extension");

    await expect(platform.bookmarkLayout.read("en")).resolves.toEqual([
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Home",
        bookmarks: [
          { type: "item", id: "bookmark-docs" },
          { type: "item", id: "bookmark-new" },
          {
            type: "folder",
            id: MIGRATED_OTHER_BOOKMARKS_FOLDER_ID,
            title: "Other",
            children: [{ type: "item", id: "bookmark-extra" }],
          },
        ],
      },
    ]);
    expect(chromeMock.create).toHaveBeenNthCalledWith(
      1,
      { title: "NewTab" },
      expect.any(Function),
    );
    expect(chromeMock.create).toHaveBeenNthCalledWith(
      2,
      {
        parentId: "new-tab-folder",
        title: "New",
        url: "https://new.example",
      },
      expect.any(Function),
    );
  });
});
