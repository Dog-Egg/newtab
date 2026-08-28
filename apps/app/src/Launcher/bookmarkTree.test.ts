import { describe, expect, it } from "vitest";
import {
  findBookmarkFolder,
  findBookmarkPath,
  flattenBookmarkItems,
  getBookmarkRoots,
  type BrowserBookmarkNode,
} from "./bookmarkTree";

const tree: BrowserBookmarkNode[] = [
  {
    type: "folder",
    id: "root",
    title: "",
    children: [
      {
        type: "folder",
        id: "bar",
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
            id: "nested",
            title: "Nested",
            children: [
              {
                type: "item",
                id: "second",
                title: "Second",
                url: "https://second.example",
              },
            ],
          },
        ],
      },
      {
        type: "folder",
        id: "other",
        title: "Other bookmarks",
        children: [],
      },
    ],
  },
];

describe("bookmarkTree", () => {
  it("unwraps Chrome's virtual root and preserves root order", () => {
    expect(getBookmarkRoots(tree).map(({ id }) => id)).toEqual([
      "bar",
      "other",
    ]);
  });

  it("flattens bookmark items in browser tree order", () => {
    expect(flattenBookmarkItems(tree).map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("finds an unlimited-depth folder path", () => {
    expect(findBookmarkPath(tree, "second")?.map(({ id }) => id)).toEqual([
      "root",
      "bar",
      "nested",
      "second",
    ]);
    expect(findBookmarkFolder(tree, "nested")?.title).toBe("Nested");
  });
});
