import { afterEach, describe, expect, it, vi } from "vitest";
import { registerBookmarkUsage } from "./bookmark-usage";
import { BOOKMARK_USAGE_KEY } from "../bookmarks/bookmark-usage";
import { BOOKMARK_USAGE_MESSAGE_TYPES } from "../bookmarks/bookmark-usage-messages";
import type { BrowserBookmarkNode } from "../bookmarks/bookmark-tree";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  tree: vi.fn(),
}));
vi.mock("../platform/chrome-storage", () => ({
  getChromeStorage: storage.read,
  setChromeStorage: storage.save,
}));
vi.mock("../platform/chrome-bookmarks", () => ({
  getBookmarkTree: storage.tree,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("background bookmark usage", () => {
  it("serializes concurrent tab clicks, persists before responding, cleans deletions and recovers after a write failure", async () => {
    const onMessage = { addListener: vi.fn() };
    const onChanged = { addListener: vi.fn() };
    const onRemoved = { addListener: vi.fn() };
    vi.stubGlobal("chrome", {
      runtime: { onMessage },
      bookmarks: { onChanged, onRemoved },
    });
    let saved: unknown;
    let tree: BrowserBookmarkNode[] = [
      { type: "item", id: "a", title: "A", url: "https://a.example/" },
    ];
    storage.read.mockImplementation(async (key) => {
      expect(key).toBe(BOOKMARK_USAGE_KEY);
      return saved;
    });
    storage.save.mockImplementation(async (_key, value) => {
      saved = value;
    });
    storage.tree.mockImplementation(async () => tree);
    vi.spyOn(Date, "now").mockReturnValue(1000);
    registerBookmarkUsage();
    expect(onChanged.addListener).not.toHaveBeenCalled();
    const handler = onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();
    for (const message of [
      null,
      {},
      { type: "unrelated" },
      { type: BOOKMARK_USAGE_MESSAGE_TYPES.record },
      { type: BOOKMARK_USAGE_MESSAGE_TYPES.record, bookmarkId: 123 },
    ]) {
      expect(handler(message, {}, sendResponse)).toBeUndefined();
    }
    expect(sendResponse).not.toHaveBeenCalled();
    expect(storage.tree).not.toHaveBeenCalled();
    const request = (type: string, bookmarkId?: string) =>
      new Promise<{
        usage?: { entries: Record<string, { score: number }> };
        success?: boolean;
        error?: string;
      }>((resolve) => {
        expect(handler({ type, bookmarkId }, {}, resolve)).toBe(true);
      });
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(BOOKMARK_USAGE_MESSAGE_TYPES.record, "a"),
      ),
    );
    expect(results).toEqual(
      Array.from({ length: 10 }, () => ({ success: true })),
    );
    expect(
      (await request(BOOKMARK_USAGE_MESSAGE_TYPES.read)).usage?.entries.a.score,
    ).toBe(10);
    expect(saved).toEqual({
      version: 1,
      entries: { a: { score: 10, lastUpdated: 1000 } },
    });
    storage.save.mockRejectedValueOnce(new Error("disk full"));
    expect(
      (await request(BOOKMARK_USAGE_MESSAGE_TYPES.record, "a")).error,
    ).toBe("disk full");
    expect(await request(BOOKMARK_USAGE_MESSAGE_TYPES.record, "a")).toEqual({
      success: true,
    });
    expect(
      (await request(BOOKMARK_USAGE_MESSAGE_TYPES.read)).usage?.entries.a.score,
    ).toBe(11);
    tree = [];
    onRemoved.addListener.mock.calls[0][0]();
    expect(
      (await request(BOOKMARK_USAGE_MESSAGE_TYPES.read)).usage?.entries,
    ).toEqual({});
    expect(saved).toEqual({ version: 1, entries: {} });
  });
});
