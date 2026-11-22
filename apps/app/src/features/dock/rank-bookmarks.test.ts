import { describe, expect, it } from "vitest";
import type { BrowserBookmarkItem } from "../../bookmarks/bookmark-tree";
import {
  parseBookmarkUsage,
  recordBookmarkUsage,
} from "../../bookmarks/bookmark-usage";
import { rankBookmarks } from "./rank-bookmarks";

const week = 7 * 24 * 60 * 60 * 1000;
const bookmark = (id: string): BrowserBookmarkItem => ({
  type: "item",
  id,
  title: id,
  url: `https://example.com/${id}`,
});

describe("Dock bookmark ranking", () => {
  it("ranks recency against frequency, excludes unclicked items and caps at ten", () => {
    let usage = parseBookmarkUsage(undefined);
    const bookmarks = Array.from({ length: 12 }, (_, i) =>
      bookmark(String(i).padStart(2, "0")),
    );
    for (const item of bookmarks.slice(0, 11))
      usage = recordBookmarkUsage(usage, item, 0);
    for (let i = 0; i < 8; i++)
      usage = recordBookmarkUsage(usage, bookmarks[0], 0);
    usage = recordBookmarkUsage(usage, bookmarks[1], week * 4);
    expect(rankBookmarks(bookmarks, usage).map((item) => item.id)).toEqual([
      "01",
      "00",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
    ]);
    expect(rankBookmarks(bookmarks, parseBookmarkUsage(undefined))).toEqual([]);
  });

  it("orders very old records and uses the current bookmark details", () => {
    const original = bookmark("a");
    const newer = bookmark("b");
    let usage = recordBookmarkUsage(
      parseBookmarkUsage(undefined),
      original,
      week,
    );
    usage = recordBookmarkUsage(usage, newer, week * 2000);
    const edited = { ...newer, url: original.url, title: "New title" };
    expect(rankBookmarks([original, edited], usage)).toEqual([
      edited,
      original,
    ]);
    const unused = { ...edited, id: "duplicate" };
    expect(rankBookmarks([unused, edited], usage)).toEqual([edited]);
  });
});
