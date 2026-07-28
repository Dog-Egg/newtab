import { afterEach, describe, expect, it, vi } from "vitest";
import { flattenBookmarkItems, getAllBookmarkItems } from "./chromeBookmarks";

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
      {
        id: "other-bookmarks",
        title: "Other bookmarks",
        syncing: false,
        children: [
          {
            id: "third",
            title: "Third",
            url: "file:///tmp/example.html",
            syncing: false,
          },
        ],
      },
    ],
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("flattenBookmarkItems", () => {
  it("returns only bookmark items from every folder as a flat list", () => {
    expect(flattenBookmarkItems(bookmarkTree)).toEqual([
      bookmarkTree[0].children?.[0].children?.[0],
      bookmarkTree[0].children?.[0].children?.[1].children?.[0],
      bookmarkTree[0].children?.[1].children?.[0],
    ]);
  });
});

describe("getAllBookmarkItems", () => {
  it("gets the Chrome bookmark tree and returns its bookmark items", async () => {
    const getTree = vi.fn(
      (callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) => {
        callback(bookmarkTree);
      },
    );
    vi.stubGlobal("chrome", {
      bookmarks: { getTree },
      runtime: {},
    });

    await expect(getAllBookmarkItems()).resolves.toEqual(
      flattenBookmarkItems(bookmarkTree),
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
      runtime: {
        lastError: { message: "Bookmarks are unavailable" },
      },
    });

    await expect(getAllBookmarkItems()).rejects.toThrow(
      "Bookmarks are unavailable",
    );
  });
});
