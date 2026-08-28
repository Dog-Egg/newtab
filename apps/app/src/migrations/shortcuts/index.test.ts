import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateShortcutsAfterExtensionUpdate } from ".";
import {
  LAUNCHER_STORAGE_KEY,
  type LegacyLauncherCategory,
} from "./legacyLauncher";

const legacyCategories: LegacyLauncherCategory[] = [
  {
    id: "default",
    name: "Home",
    shortcuts: [
      {
        type: "item",
        id: "legacy-new",
        title: "New",
        url: "https://new.example",
        createdAt: 1,
      },
    ],
  },
];

beforeEach(() => {
  vi.unstubAllGlobals();
});

function createChromeMock(
  storedItems: Record<string, unknown>,
  existingBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [],
) {
  const storageGet = vi.fn(
    (
      _keys: string | string[],
      callback: (items: Record<string, unknown>) => void,
    ) => callback(storedItems),
  );
  const storageSet = vi.fn(
    (_items: Record<string, unknown>, callback: () => void) => {
      callback();
    },
  );
  const storageRemove = vi.fn((key: string, callback: () => void) => {
    delete storedItems[key];
    callback();
  });
  const getTree = vi.fn(
    (callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) =>
      callback([
        {
          id: "root",
          title: "",
          syncing: false,
          children: existingBookmarks,
        },
      ]),
  );
  const create = vi.fn(
    (
      details: chrome.bookmarks.CreateDetails,
      callback: (bookmark: chrome.bookmarks.BookmarkTreeNode) => void,
    ) =>
      callback({
        id: details.url ? "created-bookmark" : "new-tab-folder",
        title: details.title ?? "",
        ...(details.url ? { url: details.url } : {}),
        syncing: false,
      }),
  );
  const removeTree = vi.fn((_id: string, callback: () => void) => callback());

  vi.stubGlobal("chrome", {
    runtime: {},
    storage: {
      local: { get: storageGet, set: storageSet, remove: storageRemove },
    },
    bookmarks: { getTree, create, removeTree },
  });

  return {
    create,
    getTree,
    removeTree,
    storageGet,
    storageRemove,
    storageSet,
  };
}

describe("migrateShortcutsAfterExtensionUpdate", () => {
  it.each(["install", "chrome_update"] as const)(
    "does not run for the %s lifecycle reason",
    async (reason) => {
      const chromeMock = createChromeMock({
        [LAUNCHER_STORAGE_KEY]: legacyCategories,
      });

      await migrateShortcutsAfterExtensionUpdate({ reason });

      expect(chromeMock.storageGet).not.toHaveBeenCalled();
      expect(chromeMock.getTree).not.toHaveBeenCalled();
      expect(chromeMock.create).not.toHaveBeenCalled();
      expect(chromeMock.storageSet).not.toHaveBeenCalled();
      expect(chromeMock.storageRemove).not.toHaveBeenCalled();
    },
  );

  it("exports legacy bookmarks and removes legacy data for an extension update", async () => {
    const storedItems = {
      [LAUNCHER_STORAGE_KEY]: legacyCategories,
    };
    const chromeMock = createChromeMock(storedItems);

    await migrateShortcutsAfterExtensionUpdate({
      reason: "update",
      previousVersion: "0.1.0",
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
    expect(chromeMock.storageRemove).toHaveBeenCalledWith(
      LAUNCHER_STORAGE_KEY,
      expect.any(Function),
    );
    expect(storedItems).not.toHaveProperty(LAUNCHER_STORAGE_KEY);
  });

  it("does not recreate a bookmark whose Chrome URL is normalized", async () => {
    const chromeMock = createChromeMock(
      {
        [LAUNCHER_STORAGE_KEY]: legacyCategories,
      },
      [
        {
          id: "existing-bookmark",
          title: "Existing",
          url: "https://new.example/",
          syncing: false,
        },
      ],
    );

    await migrateShortcutsAfterExtensionUpdate({
      reason: "update",
      previousVersion: "0.1.0",
    });

    expect(chromeMock.create).not.toHaveBeenCalled();
    expect(chromeMock.storageRemove).toHaveBeenCalledWith(
      LAUNCHER_STORAGE_KEY,
      expect.any(Function),
    );
  });

  it("does nothing when legacy launcher data does not exist", async () => {
    const chromeMock = createChromeMock({});

    await migrateShortcutsAfterExtensionUpdate({
      reason: "update",
      previousVersion: "0.1.0",
    });

    expect(chromeMock.getTree).not.toHaveBeenCalled();
    expect(chromeMock.create).not.toHaveBeenCalled();
    expect(chromeMock.storageRemove).not.toHaveBeenCalled();
  });
});
