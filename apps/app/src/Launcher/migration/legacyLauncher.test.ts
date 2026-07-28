import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_ID } from "../bookmarkLayout";
import type { LegacyLauncherCategory } from "../legacyLauncher";
import {
  collectLegacyBookmarksToExport,
  MIGRATED_OTHER_BOOKMARKS_FOLDER_ID,
  migrateLegacyLauncherToBookmarkLayout,
} from "./legacyLauncher";

const categories: LegacyLauncherCategory[] = [
  {
    id: "work",
    name: "Work",
    shortcuts: [
      {
        type: "item",
        id: "old-docs",
        title: "Docs",
        url: "https://docs.example",
        createdAt: 1,
      },
      {
        type: "folder",
        id: "development",
        title: "Development",
        createdAt: 2,
        children: [
          {
            type: "item",
            id: "old-github",
            title: "GitHub",
            url: "https://github.com",
            createdAt: 3,
          },
          {
            type: "item",
            id: "duplicate-docs",
            title: "Duplicate Docs",
            url: "https://docs.example",
            createdAt: 4,
          },
        ],
      },
    ],
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: "Home",
    shortcuts: [
      {
        type: "item",
        id: "old-new",
        title: "New",
        url: "https://new.example",
        createdAt: 5,
      },
      {
        type: "item",
        id: "old-invalid",
        title: "Invalid",
        url: "javascript:void(0)",
        createdAt: 6,
      },
    ],
  },
];

describe("collectLegacyBookmarksToExport", () => {
  it("returns unique legacy entries that do not exist in Chrome", () => {
    expect(
      collectLegacyBookmarksToExport(categories, [
        {
          id: "bookmark-docs",
          title: "Docs in Chrome",
          url: "https://docs.example",
        },
      ]).map(({ id }) => id),
    ).toEqual(["old-github", "old-new"]);
  });
});

describe("migrateLegacyLauncherToBookmarkLayout", () => {
  it("preserves category and folder order while replacing entries with IDs", () => {
    expect(
      migrateLegacyLauncherToBookmarkLayout(
        categories,
        [
          {
            id: "bookmark-extra",
            title: "Unmanaged",
            url: "https://extra.example",
          },
          {
            id: "bookmark-docs",
            title: "Docs in Chrome",
            url: "https://docs.example",
          },
          {
            id: "bookmark-github",
            title: "GitHub in Chrome",
            url: "https://github.com",
          },
          {
            id: "bookmark-new",
            title: "New in Chrome",
            url: "https://new.example",
          },
        ],
        "其他",
      ),
    ).toEqual([
      {
        id: "work",
        name: "Work",
        bookmarks: [
          { type: "item", id: "bookmark-docs" },
          {
            type: "folder",
            id: "development",
            title: "Development",
            children: [{ type: "item", id: "bookmark-github" }],
          },
        ],
      },
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Home",
        bookmarks: [
          { type: "item", id: "bookmark-new" },
          {
            type: "folder",
            id: MIGRATED_OTHER_BOOKMARKS_FOLDER_ID,
            title: "其他",
            children: [{ type: "item", id: "bookmark-extra" }],
          },
        ],
      },
    ]);
  });

  it("keeps duplicate Chrome bookmarks in the trailing 其他 folder", () => {
    expect(
      migrateLegacyLauncherToBookmarkLayout(
        [categories[1]],
        [
          {
            id: "bookmark-new-first",
            title: "New first",
            url: "https://new.example",
          },
          {
            id: "bookmark-new-duplicate",
            title: "New duplicate",
            url: "https://new.example",
          },
        ],
        "Other",
      )[0].bookmarks,
    ).toEqual([
      { type: "item", id: "bookmark-new-first" },
      {
        type: "folder",
        id: MIGRATED_OTHER_BOOKMARKS_FOLDER_ID,
        title: "Other",
        children: [{ type: "item", id: "bookmark-new-duplicate" }],
      },
    ]);
  });
});
