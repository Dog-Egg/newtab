import { describe, expect, it } from "vitest";
import {
  parseBookmarkUsage,
  reconcileBookmarkUsage,
  recordBookmarkUsage,
} from "./bookmark-usage";
import type { BrowserBookmarkItem } from "./bookmark-tree";

const week = 7 * 24 * 60 * 60 * 1000;
const bookmark = (id: string): BrowserBookmarkItem => ({
  type: "item",
  id,
  title: id,
  url: `https://example.com/${id}`,
});

describe("bookmark usage", () => {
  it("adds every click after decaying prior contributions by a seven day half-life", () => {
    let usage = recordBookmarkUsage(
      parseBookmarkUsage(undefined),
      bookmark("a"),
      week,
    );
    usage = recordBookmarkUsage(usage, bookmark("a"), week);
    expect(usage.entries.a.score).toBe(2);
    usage = recordBookmarkUsage(usage, bookmark("a"), week * 2);
    expect(usage.entries.a).toEqual({ score: 2, lastUpdated: week * 2 });
    usage = recordBookmarkUsage(usage, bookmark("a"), week * 4);
    expect(usage.entries.a.score).toBe(1.5);
  });

  it("keeps duplicate URLs separate and retains usage after moves, renames and URL edits", () => {
    const original = bookmark("a");
    const duplicate = { ...original, id: "b" };
    const usage = recordBookmarkUsage(
      parseBookmarkUsage(undefined),
      original,
      week,
    );
    const edited = {
      ...original,
      title: "new name",
      url: "https://new.example/",
      parentId: "folder",
    };
    expect(reconcileBookmarkUsage(usage, [edited, duplicate])).toBe(usage);
    expect(reconcileBookmarkUsage(usage, [duplicate]).entries).toEqual({});
  });

  it("handles clock rollback without increasing old contributions", () => {
    let usage = recordBookmarkUsage(
      parseBookmarkUsage(undefined),
      bookmark("a"),
      week,
    );
    usage = recordBookmarkUsage(usage, bookmark("a"), 0);
    expect(usage.entries.a).toEqual({ score: 2, lastUpdated: week });
  });

  it("ignores invalid storage and invalid entries while preserving valid records", () => {
    for (const value of [
      null,
      "bad",
      { version: 2, entries: {} },
      { version: 1 },
      { version: 1, entries: [] },
    ])
      expect(parseBookmarkUsage(value).entries).toEqual({});
    expect(
      parseBookmarkUsage({
        version: 1,
        entries: {
          a: { score: 2, lastUpdated: 123, extra: "discarded" },
          b: { score: Infinity, lastUpdated: 123 },
          c: { score: -1, lastUpdated: 123 },
          d: { score: 1, lastUpdated: "yesterday" },
          e: null,
          f: { score: 0, lastUpdated: 123 },
          g: { score: NaN, lastUpdated: 123 },
          h: { score: 1, lastUpdated: -1 },
          i: { score: 1, lastUpdated: Infinity },
          j: { score: 1, lastUpdated: NaN },
          k: { score: "2", lastUpdated: 123 },
          l: { score: 1, lastUpdated: 0 },
        },
      }).entries,
    ).toEqual({
      a: { score: 2, lastUpdated: 123 },
      l: { score: 1, lastUpdated: 0 },
    });
  });
});
