import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_ID } from "./launcher";
import {
  normalizeBookmarkLayout,
  placeBookmarkLayoutItemAtRoot,
  placeLauncherBookmarkAtRoot,
  resolveBookmarkLayout,
  toBookmarkLayout,
  type BookmarkLayoutCategory,
} from "./bookmarkLayout";

describe("bookmark layout", () => {
  it("puts unmanaged browser bookmarks first in the default category", () => {
    const layout: BookmarkLayoutCategory[] = [
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Home",
        bookmarks: [{ type: "item", id: "managed" }],
      },
      {
        id: "work",
        name: "Work",
        bookmarks: [
          {
            type: "folder",
            id: "folder",
            title: "Tools",
            children: [{ type: "item", id: "nested" }],
          },
        ],
      },
    ];

    expect(
      resolveBookmarkLayout(layout, [
        { id: "extra-1", title: "Extra 1", url: "https://extra-1.test" },
        { id: "managed", title: "Managed", url: "https://managed.test" },
        { id: "extra-2", title: "Extra 2", url: "https://extra-2.test" },
        { id: "nested", title: "Nested", url: "https://nested.test" },
      ]),
    ).toEqual([
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Home",
        bookmarks: [
          {
            type: "item",
            id: "extra-1",
            title: "Extra 1",
            url: "https://extra-1.test",
          },
          {
            type: "item",
            id: "extra-2",
            title: "Extra 2",
            url: "https://extra-2.test",
          },
          {
            type: "item",
            id: "managed",
            title: "Managed",
            url: "https://managed.test",
          },
        ],
      },
      {
        id: "work",
        name: "Work",
        bookmarks: [
          {
            type: "folder",
            id: "folder",
            title: "Tools",
            children: [
              {
                type: "item",
                id: "nested",
                title: "Nested",
                url: "https://nested.test",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps the old launcher shape out of the new layout field", () => {
    const normalized = normalizeBookmarkLayout(
      [
        {
          id: DEFAULT_CATEGORY_ID,
          name: " Home ",
          bookmarks: [
            {
              type: "item",
              id: "bookmark-id",
              title: "must not persist",
              url: "https://example.test",
            },
          ],
        },
      ],
      "Home",
    );

    expect(
      toBookmarkLayout(
        resolveBookmarkLayout(normalized, [
          {
            id: "bookmark-id",
            title: "Browser title",
            url: "https://browser.test",
          },
        ]),
      ),
    ).toEqual([
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Home",
        bookmarks: [{ type: "item", id: "bookmark-id" }],
      },
    ]);
  });

  it("moves one bookmark ID to exactly one target root position", () => {
    const categories = resolveBookmarkLayout(
      [
        {
          id: DEFAULT_CATEGORY_ID,
          name: "Home",
          bookmarks: [{ type: "item", id: "bookmark-id" }],
        },
        {
          id: "work",
          name: "Work",
          bookmarks: [
            {
              type: "folder",
              id: "folder",
              title: "Tools",
              children: [{ type: "item", id: "bookmark-id" }],
            },
          ],
        },
      ],
      [
        {
          id: "bookmark-id",
          title: "Bookmark",
          url: "https://example.test",
        },
      ],
    );

    expect(
      toBookmarkLayout(
        placeLauncherBookmarkAtRoot(categories, "work", {
          type: "item",
          id: "bookmark-id",
          title: "Bookmark",
          url: "https://example.test",
        }),
      ),
    ).toEqual([
      { id: DEFAULT_CATEGORY_ID, name: "Home", bookmarks: [] },
      {
        id: "work",
        name: "Work",
        bookmarks: [{ type: "item", id: "bookmark-id" }],
      },
    ]);
  });

  it("places a context-menu bookmark at the target root front", () => {
    expect(
      placeBookmarkLayoutItemAtRoot(
        [
          {
            id: DEFAULT_CATEGORY_ID,
            name: "Home",
            bookmarks: [{ type: "item", id: "bookmark-id" }],
          },
          {
            id: "work",
            name: "Work",
            bookmarks: [{ type: "item", id: "existing" }],
          },
        ],
        "work",
        "bookmark-id",
      ),
    ).toEqual([
      { id: DEFAULT_CATEGORY_ID, name: "Home", bookmarks: [] },
      {
        id: "work",
        name: "Work",
        bookmarks: [
          { type: "item", id: "bookmark-id" },
          { type: "item", id: "existing" },
        ],
      },
    ]);
  });
});
