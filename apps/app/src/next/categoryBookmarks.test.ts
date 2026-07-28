import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_ID,
  type ShortcutCategory,
} from "../Launcher/launcher";
import type { BookmarkItem } from "./bookmarks";
import {
  mapCategoriesToBookmarkNodes,
  OTHER_BOOKMARKS_FOLDER_ID,
  OTHER_BOOKMARKS_FOLDER_TITLE,
} from "./categoryBookmarks";

const categories: ShortcutCategory[] = [
  {
    id: "work",
    name: "Work",
    shortcuts: [
      {
        type: "item",
        id: "shortcut-docs",
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
            id: "shortcut-github",
            title: "GitHub",
            url: "https://github.com",
            createdAt: 3,
          },
          {
            type: "item",
            id: "shortcut-missing",
            title: "Missing",
            url: "https://missing.example",
            createdAt: 4,
          },
          {
            type: "item",
            id: "shortcut-npm",
            title: "npm",
            url: "https://npmjs.com",
            createdAt: 5,
          },
        ],
      },
    ],
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: "Personal",
    shortcuts: [
      {
        type: "item",
        id: "shortcut-music",
        title: "Music",
        url: "https://music.example",
        createdAt: 6,
      },
      {
        type: "folder",
        id: "empty-after-mapping",
        title: "Empty after mapping",
        createdAt: 7,
        children: [
          {
            type: "item",
            id: "another-missing-shortcut",
            title: "Another missing shortcut",
            url: "https://another-missing.example",
            createdAt: 8,
          },
        ],
      },
    ],
  },
];

const bookmarkItems: BookmarkItem[] = [
  {
    id: "bookmark-extra-first",
    title: "Extra first",
    url: "https://extra-first.example",
    syncing: false,
  },
  {
    id: "bookmark-docs",
    title: "Docs bookmark",
    url: "https://docs.example",
    syncing: false,
  },
  {
    id: "bookmark-github",
    title: "GitHub bookmark",
    url: "https://github.com",
    syncing: false,
  },
  {
    id: "bookmark-npm",
    title: "npm bookmark",
    url: "https://npmjs.com",
    syncing: false,
  },
  {
    id: "duplicate-bookmark-npm",
    title: "Duplicate npm bookmark",
    url: "https://npmjs.com",
    syncing: false,
  },
  {
    id: "bookmark-music",
    title: "Music bookmark",
    url: "https://music.example",
    syncing: false,
  },
  {
    id: "bookmark-extra-second",
    title: "Extra second",
    url: "https://extra-second.example",
    syncing: false,
  },
];

describe("mapCategoriesToBookmarkNodes", () => {
  it("maps URLs to bookmark IDs while preserving category and nesting order", () => {
    expect(mapCategoriesToBookmarkNodes(categories, bookmarkItems)).toEqual([
      {
        id: "work",
        name: "Work",
        shortcuts: [
          { type: "item", id: "bookmark-docs" },
          {
            type: "folder",
            id: "development",
            title: "Development",
            children: [
              { type: "item", id: "bookmark-github" },
              { type: "item", id: "bookmark-npm" },
            ],
          },
        ],
      },
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Personal",
        shortcuts: [
          { type: "item", id: "bookmark-music" },
          {
            type: "folder",
            id: "empty-after-mapping",
            title: "Empty after mapping",
            children: [],
          },
          {
            type: "folder",
            id: OTHER_BOOKMARKS_FOLDER_ID,
            title: OTHER_BOOKMARKS_FOLDER_TITLE,
            children: [
              { type: "item", id: "bookmark-extra-first" },
              { type: "item", id: "bookmark-extra-second" },
            ],
          },
        ],
      },
    ]);
  });

  it("appends extra bookmarks to an existing 其他 folder", () => {
    const categoriesWithOtherFolder: ShortcutCategory[] = [
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Default",
        shortcuts: [
          {
            type: "folder",
            id: OTHER_BOOKMARKS_FOLDER_ID,
            title: "其他",
            createdAt: 1,
            children: [
              {
                type: "item",
                id: "existing-extra",
                title: "Existing extra",
                url: "https://existing-extra.example",
                createdAt: 2,
              },
            ],
          },
        ],
      },
    ];

    expect(
      mapCategoriesToBookmarkNodes(categoriesWithOtherFolder, [
        {
          id: "bookmark-existing-extra",
          title: "Existing extra",
          url: "https://existing-extra.example",
          syncing: false,
        },
        {
          id: "bookmark-new-extra",
          title: "New extra",
          url: "https://new-extra.example",
          syncing: false,
        },
      ]),
    ).toEqual([
      {
        id: DEFAULT_CATEGORY_ID,
        name: "Default",
        shortcuts: [
          {
            type: "folder",
            id: OTHER_BOOKMARKS_FOLDER_ID,
            title: OTHER_BOOKMARKS_FOLDER_TITLE,
            children: [
              { type: "item", id: "bookmark-existing-extra" },
              { type: "item", id: "bookmark-new-extra" },
            ],
          },
        ],
      },
    ]);
  });
});
