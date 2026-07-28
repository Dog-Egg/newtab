import { describe, expect, it } from "vitest";
import { createWebBookmarkMocks } from "./webBookmarkMocks";

describe("createWebBookmarkMocks", () => {
  it("creates native bookmark entities matching every layout item", () => {
    const { layout, bookmarks } = createWebBookmarkMocks("en");
    const layoutIds = layout.flatMap((category) =>
      category.bookmarks.flatMap((node) =>
        node.type === "item"
          ? [node.id]
          : node.children.map((child) => child.id),
      ),
    );

    expect(layout.map((category) => category.id)).toEqual([
      "default",
      "category-work",
      "category-inspiration",
    ]);
    expect(new Set(layoutIds)).toEqual(
      new Set(bookmarks.map((bookmark) => bookmark.id)),
    );
    expect(layout.some((category) => category.bookmarks.length > 0)).toBe(true);
  });

  it("localizes category and folder titles without changing bookmark IDs", () => {
    const english = createWebBookmarkMocks("en");
    const chinese = createWebBookmarkMocks("zh-CN");

    expect(chinese.layout[0].name).not.toBe(english.layout[0].name);
    expect(chinese.layout[0].bookmarks[1]).toMatchObject({
      type: "folder",
      title: "日常",
    });
    expect(chinese.bookmarks.map(({ id }) => id)).toEqual(
      english.bookmarks.map(({ id }) => id),
    );
  });
});
