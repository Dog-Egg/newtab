import { describe, expect, it } from "vitest";
import {
  collectLegacyBookmarksToExport,
  normalizeStoredExtensionLauncher,
} from "./migration";
import type { LegacyLauncherCategory } from "./schema";

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
      {
        type: "item",
        id: "old-invalid",
        title: "Invalid",
        url: "javascript:void(0)",
        createdAt: 5,
      },
    ],
  },
];

describe("collectLegacyBookmarksToExport", () => {
  it("returns unique HTTP(S) entries that do not exist in the browser", () => {
    expect(
      collectLegacyBookmarksToExport(categories, [
        {
          id: "bookmark-docs",
          title: "Docs in Chrome",
          url: "https://docs.example",
        },
      ]).map(({ id }) => id),
    ).toEqual(["old-github"]);
  });
});

describe("normalizeStoredExtensionLauncher", () => {
  it("does not inject demo bookmarks into a fresh extension profile", () => {
    expect(normalizeStoredExtensionLauncher(undefined, "en")).toEqual([
      { id: "default", name: "Home", shortcuts: [] },
    ]);
  });

  it("keeps existing launcher storage readable", () => {
    const stored = [
      {
        id: "default",
        name: "Saved",
        shortcuts: [
          {
            type: "item" as const,
            id: "saved",
            title: "Saved",
            url: "https://example.com",
            createdAt: 1,
          },
        ],
      },
    ];

    expect(normalizeStoredExtensionLauncher(stored, "en")).toEqual(stored);
  });
});
