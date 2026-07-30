import { beforeEach, describe, expect, it, vi } from "vitest";

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
  const storageGet = vi.fn(
    (
      _keys: string | string[],
      callback: (items: Record<string, unknown>) => void,
    ) => callback(storedItems),
  );
  const get = vi.fn();
  const move = vi.fn();

  vi.stubGlobal("chrome", {
    i18n: { getUILanguage: () => "en" },
    runtime: {},
    storage: {
      local: {
        get: storageGet,
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

  return { create, get, getTree, move, set, storageGet };
}

describe("extension bookmark reads", () => {
  it("reads the native tree without checking or running legacy migration", async () => {
    const tree: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: "root",
        title: "",
        syncing: false,
        children: [],
      },
    ];
    const chromeMock = createChromeMock({ unrelated: "stored value" }, [tree]);
    const { platform } = await import("./extension");

    await expect(platform.bookmarks.read()).resolves.toEqual([
      { type: "folder", id: "root", title: "", children: [] },
    ]);
    expect(chromeMock.getTree).toHaveBeenCalledOnce();
    expect(chromeMock.storageGet).not.toHaveBeenCalled();
    expect(chromeMock.create).not.toHaveBeenCalled();
    expect(chromeMock.set).not.toHaveBeenCalled();
  });
});

describe("extension bookmark mutations", () => {
  it("converts a forward reorder to Chrome's pre-removal insertion index", async () => {
    const chromeMock = createChromeMock({}, [
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
