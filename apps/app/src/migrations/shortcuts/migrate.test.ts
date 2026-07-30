import { describe, expect, it, vi } from "vitest";
import {
  collectLegacyShortcutsToExport,
  migrateLegacyShortcutsOnce,
} from "./migrate";
import type { LegacyLauncherCategory } from "./legacyLauncher";

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

describe("collectLegacyShortcutsToExport", () => {
  it("returns unique HTTP(S) entries that do not exist in the browser", () => {
    expect(
      collectLegacyShortcutsToExport(categories, [
        {
          id: "bookmark-docs",
          title: "Docs in Chrome",
          url: "https://docs.example/",
        },
      ]).map(({ id }) => id),
    ).toEqual(["old-github"]);
  });

  it("deduplicates equivalent normalized URLs in legacy data", () => {
    const equivalentCategories: LegacyLauncherCategory[] = [
      {
        id: "equivalent",
        name: "Equivalent",
        shortcuts: [
          {
            type: "item",
            id: "first",
            title: "First",
            url: "https://EXAMPLE.com:443",
            createdAt: 1,
          },
          {
            type: "item",
            id: "second",
            title: "Second",
            url: "https://example.com/",
            createdAt: 2,
          },
        ],
      },
    ];

    expect(
      collectLegacyShortcutsToExport(equivalentCategories, []).map(
        ({ id }) => id,
      ),
    ).toEqual(["first"]);
  });
});

describe("migrateLegacyShortcutsOnce", () => {
  it("does nothing when legacy launcher data does not exist", async () => {
    const removeStorage = vi.fn();
    const readBookmarks = vi.fn();
    const createBookmark = vi.fn();

    await migrateLegacyShortcutsOnce({
      readStorage: vi.fn().mockResolvedValue({}),
      removeStorage,
      readBookmarks,
      createBookmark,
      removeBookmarkFolder: vi.fn(),
    });

    expect(readBookmarks).not.toHaveBeenCalled();
    expect(createBookmark).not.toHaveBeenCalled();
    expect(removeStorage).not.toHaveBeenCalled();
  });

  it("removes empty legacy launcher data without creating a folder", async () => {
    const removeStorage = vi.fn().mockResolvedValue(undefined);
    const createBookmark = vi.fn();

    await migrateLegacyShortcutsOnce({
      readStorage: vi.fn().mockResolvedValue({ launcher: [] }),
      removeStorage,
      readBookmarks: vi.fn().mockResolvedValue([]),
      createBookmark,
      removeBookmarkFolder: vi.fn(),
    });

    expect(createBookmark).not.toHaveBeenCalled();
    expect(removeStorage).toHaveBeenCalledOnce();
    expect(removeStorage).toHaveBeenCalledWith("launcher");
  });

  it("preserves legacy data when bookmark creation fails", async () => {
    const removeStorage = vi.fn();
    const createError = new Error("bookmark creation failed");
    const removeBookmarkFolder = vi.fn();

    await expect(
      migrateLegacyShortcutsOnce({
        readStorage: vi.fn().mockResolvedValue({ launcher: categories }),
        removeStorage,
        readBookmarks: vi.fn().mockResolvedValue([]),
        createBookmark: vi.fn().mockRejectedValue(createError),
        removeBookmarkFolder,
      }),
    ).rejects.toBe(createError);

    expect(removeBookmarkFolder).not.toHaveBeenCalled();
    expect(removeStorage).not.toHaveBeenCalled();
  });

  it("removes the incomplete folder when a child bookmark creation fails", async () => {
    const removeStorage = vi.fn();
    const removeBookmarkFolder = vi.fn().mockResolvedValue(undefined);
    const createError = new Error("child bookmark creation failed");
    const createBookmark = vi
      .fn()
      .mockResolvedValueOnce({ id: "new-tab-folder" })
      .mockResolvedValueOnce({ id: "created-docs" })
      .mockRejectedValueOnce(createError);

    await expect(
      migrateLegacyShortcutsOnce({
        readStorage: vi.fn().mockResolvedValue({ launcher: categories }),
        removeStorage,
        readBookmarks: vi.fn().mockResolvedValue([]),
        createBookmark,
        removeBookmarkFolder,
      }),
    ).rejects.toBe(createError);

    expect(removeBookmarkFolder).toHaveBeenCalledOnce();
    expect(removeBookmarkFolder).toHaveBeenCalledWith("new-tab-folder");
    expect(removeStorage).not.toHaveBeenCalled();
  });

  it("preserves both errors when migration and cleanup fail", async () => {
    const migrationError = new Error("child bookmark creation failed");
    const cleanupError = new Error("folder cleanup failed");

    await expect(
      migrateLegacyShortcutsOnce({
        readStorage: vi.fn().mockResolvedValue({ launcher: categories }),
        removeStorage: vi.fn(),
        readBookmarks: vi.fn().mockResolvedValue([]),
        createBookmark: vi
          .fn()
          .mockResolvedValueOnce({ id: "new-tab-folder" })
          .mockRejectedValueOnce(migrationError),
        removeBookmarkFolder: vi.fn().mockRejectedValue(cleanupError),
      }),
    ).rejects.toMatchObject({
      name: "ShortcutMigrationRollbackError",
      migrationError,
      cleanupError,
    });
  });
});
