import { describe, expect, it } from "vitest";
import type { BrowserBookmarkItem } from "../Launcher/bookmarkTree";
import { findSearchSuggestions } from "./searchSuggestionUtils";

const bookmarks: BrowserBookmarkItem[] = [
  {
    type: "item",
    id: "design-docs",
    title: "Product Design Documents",
    url: "https://docs.example.com/design",
  },
  {
    type: "item",
    id: "dashboard",
    title: "Dashboard",
    url: "https://portal.example.com/dashboard",
  },
  {
    type: "item",
    id: "design-system",
    title: "Design System",
    url: "https://ui.example.com",
  },
  {
    type: "item",
    id: "cloudflare-access",
    title: "Internal Gateway",
    url: "https://myteam.cloudflareaccess.com/",
  },
  {
    type: "item",
    id: "cloudflare",
    title: "Public Website",
    url: "https://cloudflare.com/",
  },
];

function findBookmarks(input: string) {
  return findSearchSuggestions({
    engines: [],
    bookmarks,
    input,
    selectedEngineId: "",
    temporaryEngineId: null,
  }).map((suggestion) => {
    if (suggestion.type !== "bookmark") {
      throw new Error("Expected a bookmark suggestion");
    }
    return suggestion.bookmark;
  });
}

function findBookmarkSuggestions(input: string) {
  return findSearchSuggestions({
    engines: [],
    bookmarks,
    input,
    selectedEngineId: "",
    temporaryEngineId: null,
  }).map((suggestion) => {
    if (suggestion.type !== "bookmark") {
      throw new Error("Expected a bookmark suggestion");
    }
    return suggestion;
  });
}

describe("findSearchSuggestions bookmark matching", () => {
  it("matches text contained anywhere in a bookmark title", () => {
    expect(findBookmarks("documents").map((bookmark) => bookmark.id)).toEqual([
      "design-docs",
    ]);
  });

  it("matches titles case-insensitively after trimming the input", () => {
    expect(
      findBookmarks("  DOCUMENTS  ").map((bookmark) => bookmark.id),
    ).toEqual(["design-docs"]);
  });

  it("prioritizes title matches that occur earlier", () => {
    expect(findBookmarks("design").map((bookmark) => bookmark.id)).toEqual([
      "design-system",
      "design-docs",
    ]);
  });

  it("matches prefixes at the start of any non-TLD hostname segment", () => {
    expect(
      findBookmarks("portal.example").map((bookmark) => bookmark.id),
    ).toEqual(["dashboard"]);
    expect(findBookmarks("cloud").map((bookmark) => bookmark.id)).toEqual([
      "cloudflare-access",
      "cloudflare",
    ]);
    expect(findBookmarks("example.com/dashboard")).toEqual([]);
  });

  it("does not match a URL by its top-level domain", () => {
    expect(findBookmarks("com")).toEqual([]);
  });

  it("returns the exact title match range used by the renderer", () => {
    expect(findBookmarkSuggestions("documents")[0].matches).toEqual({
      title: [{ start: 15, length: 9 }],
      domain: [],
    });
  });

  it("returns domain ranges for matches in different hostname segments", () => {
    expect(
      findBookmarkSuggestions("cloud").map((suggestion) => ({
        id: suggestion.bookmark.id,
        matches: suggestion.matches,
      })),
    ).toEqual([
      {
        id: "cloudflare-access",
        matches: {
          title: [],
          domain: [{ start: 7, length: 5 }],
        },
      },
      {
        id: "cloudflare",
        matches: {
          title: [],
          domain: [{ start: 0, length: 5 }],
        },
      },
    ]);
  });
});
