import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBookmarkTree,
  toBrowserBookmarkNode,
  toChromeMoveDestination,
} from "./chromeBookmarks";

const bookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: "root",
    title: "",
    syncing: false,
    children: [
      {
        id: "bookmarks-bar",
        title: "Bookmarks bar",
        syncing: false,
        children: [
          {
            id: "first",
            title: "First",
            url: "https://first.example",
            syncing: false,
          },
          {
            id: "nested-folder",
            title: "Nested folder",
            syncing: false,
            children: [
              {
                id: "second",
                title: "Second",
                url: "chrome://settings",
                syncing: false,
              },
            ],
          },
        ],
      },
    ],
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toBrowserBookmarkNode", () => {
  it("preserves the browser folder hierarchy and order", () => {
    expect(bookmarkTree.map(toBrowserBookmarkNode)).toEqual([
      {
        type: "folder",
        id: "root",
        title: "",
        children: [
          {
            type: "folder",
            id: "bookmarks-bar",
            title: "Bookmarks bar",
            children: [
              {
                type: "item",
                id: "first",
                title: "First",
                url: "https://first.example",
              },
              {
                type: "folder",
                id: "nested-folder",
                title: "Nested folder",
                children: [
                  {
                    type: "item",
                    id: "second",
                    title: "Second",
                    url: "chrome://settings",
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe("toChromeMoveDestination", () => {
  const current = { parentId: "bookmarks-bar", index: 1 };

  it("compensates Chrome's insertion index when moving forward in one folder", () => {
    expect(
      toChromeMoveDestination(current, {
        parentId: "bookmarks-bar",
        index: 2,
      }),
    ).toEqual({ parentId: "bookmarks-bar", index: 3 });
  });

  it("keeps the final index when moving backward or across folders", () => {
    expect(
      toChromeMoveDestination(current, {
        parentId: "bookmarks-bar",
        index: 0,
      }),
    ).toEqual({ parentId: "bookmarks-bar", index: 0 });
    expect(
      toChromeMoveDestination(current, {
        parentId: "other-bookmarks",
        index: 2,
      }),
    ).toEqual({ parentId: "other-bookmarks", index: 2 });
  });
});

describe("getBookmarkTree", () => {
  it("returns the complete Chrome bookmark tree", async () => {
    const getTree = vi.fn(
      (callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
        callback(bookmarkTree);
      },
    );
    vi.stubGlobal("chrome", { bookmarks: { getTree }, runtime: {} });

    await expect(getBookmarkTree()).resolves.toEqual(
      bookmarkTree.map(toBrowserBookmarkNode),
    );
    expect(getTree).toHaveBeenCalledOnce();
  });

  it("rejects when Chrome reports an error", async () => {
    vi.stubGlobal("chrome", {
      bookmarks: {
        getTree: (
          callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) => callback([]),
      },
      runtime: { lastError: { message: "Bookmarks are unavailable" } },
    });

    await expect(getBookmarkTree()).rejects.toThrow(
      "Bookmarks are unavailable",
    );
  });
});
