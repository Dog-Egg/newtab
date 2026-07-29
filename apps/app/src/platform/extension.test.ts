import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAUNCHER_STORAGE_KEY,
  type LegacyLauncherCategory,
} from "../Launcher/legacyLauncher";

const MIGRATION_KEY = "bookmark-tree-migration-completed";
const legacyCategories: LegacyLauncherCategory[] = [
  {
    id: "default",
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

function createEventMock() {
  return { addListener: vi.fn(), removeListener: vi.fn() };
}

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
  const set = vi.fn((items: Record<string, unknown>, callback: () => void) => {
    Object.assign(storedItems, items);
    callback();
  });
  const get = vi.fn();
  const move = vi.fn();

  vi.stubGlobal("chrome", {
    i18n: { getUILanguage: () => "en" },
    runtime: {},
    storage: {
      local: {
        get: (
          _keys: string | string[],
          callback: (items: Record<string, unknown>) => void,
        ) => callback(storedItems),
        set,
      },
      onChanged: createEventMock(),
    },
    bookmarks: {
      getTree,
      create,
      get,
      update: vi.fn(),
      move,
      remove: vi.fn(),
      removeTree: vi.fn(),
      onCreated: createEventMock(),
      onChanged: createEventMock(),
      onMoved: createEventMock(),
      onRemoved: createEventMock(),
      onChildrenReordered: createEventMock(),
      onImportEnded: createEventMock(),
    },
  });

  return { create, get, getTree, move, set };
}

describe("extension legacy Launcher migration", () => {
  it("skips legacy export after the dedicated migration marker exists", async () => {
    const tree: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: "root", title: "", syncing: false, children: [] },
    ];
    const chromeMock = createChromeMock({ [MIGRATION_KEY]: true }, [tree]);
    const { platform } = await import("./extension");

    await expect(platform.bookmarks.read()).resolves.toEqual([
      {
        type: "folder",
        id: "root",
        title: "",
        children: [],
      },
    ]);
    expect(chromeMock.getTree).toHaveBeenCalledOnce();
    expect(chromeMock.create).not.toHaveBeenCalled();
  });

  it("exports missing legacy URLs once, marks completion, then returns the native tree", async () => {
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
        ],
      },
    ];
    const afterExport: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        ...beforeExport[0],
        children: [
          ...beforeExport[0].children!,
          {
            id: "new-tab-folder",
            title: "NewTab",
            syncing: false,
            children: [
              {
                id: "bookmark-new",
                title: "New",
                url: "https://new.example",
                syncing: false,
              },
            ],
          },
        ],
      },
    ];
    const chromeMock = createChromeMock(
      { [LAUNCHER_STORAGE_KEY]: legacyCategories },
      [beforeExport, afterExport],
    );
    const { platform } = await import("./extension");

    const tree = await platform.bookmarks.read();
    expect(tree[0]).toMatchObject({
      type: "folder",
      children: [
        { type: "item", id: "bookmark-docs" },
        {
          type: "folder",
          id: "new-tab-folder",
          children: [{ type: "item", id: "bookmark-new" }],
        },
      ],
    });
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
    expect(chromeMock.set).toHaveBeenCalledWith(
      { [MIGRATION_KEY]: true },
      expect.any(Function),
    );
  });
});

describe("extension bookmark mutations", () => {
  it("converts a forward reorder to Chrome's pre-removal insertion index", async () => {
    const chromeMock = createChromeMock({ [MIGRATION_KEY]: true }, [
      [{ id: "root", title: "", syncing: false, children: [] }],
    ]);
    chromeMock.get.mockImplementation(
      (
        _id: string,
        callback: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void,
      ) => {
        callback([
          {
            id: "second",
            parentId: "bookmarks-bar",
            index: 1,
            title: "Second",
            url: "https://second.example",
            syncing: false,
          },
        ]);
      },
    );
    chromeMock.move.mockImplementation(
      (
        id: string,
        destination: chrome.bookmarks.MoveDestination,
        callback: (node: chrome.bookmarks.BookmarkTreeNode) => void,
      ) => {
        callback({
          id,
          parentId: destination.parentId,
          index: 2,
          title: "Second",
          url: "https://second.example",
          syncing: false,
        });
      },
    );
    const { platform } = await import("./extension");

    await platform.bookmarks.move("second", {
      parentId: "bookmarks-bar",
      index: 2,
    });

    expect(chromeMock.move).toHaveBeenCalledWith(
      "second",
      { parentId: "bookmarks-bar", index: 3 },
      expect.any(Function),
    );
  });
});
