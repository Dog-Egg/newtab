import { describe, expect, it } from "vitest";
import type { BrowserBookmarkFolder } from "./bookmarkTree";
import { findBookmarkRevealDestination } from "./bookmarkNavigation";

const roots: BrowserBookmarkFolder[] = [
  {
    type: "folder",
    id: "bar",
    title: "Bookmarks bar",
    children: [
      {
        type: "item",
        id: "direct",
        title: "Direct bookmark",
        url: "https://direct.example",
      },
      {
        type: "folder",
        id: "nested",
        title: "Nested",
        children: [
          {
            type: "item",
            id: "deep",
            title: "Deep bookmark",
            url: "https://deep.example",
          },
        ],
      },
    ],
  },
];

describe("findBookmarkRevealDestination", () => {
  it("opens a nested bookmark's immediate parent folder", () => {
    expect(findBookmarkRevealDestination(roots, "deep")).toEqual({
      rootId: "bar",
      folderId: "nested",
    });
  });

  it("uses the root page for a direct child bookmark", () => {
    expect(findBookmarkRevealDestination(roots, "direct")).toEqual({
      rootId: "bar",
      folderId: null,
    });
  });

  it("rejects folders and missing nodes", () => {
    expect(findBookmarkRevealDestination(roots, "nested")).toBeNull();
    expect(findBookmarkRevealDestination(roots, "missing")).toBeNull();
  });
});
