import { describe, expect, it } from "vitest";
import type { ShortcutCategory } from "../Launcher/launcher";
import { collectNewBookmarkShortcuts } from ".";

const categories: ShortcutCategory[] = [
  {
    id: "home",
    name: "Home",
    shortcuts: [
      {
        type: "item",
        id: "existing",
        title: "Existing",
        url: "https://existing.example",
        createdAt: 1,
      },
      {
        type: "folder",
        id: "folder",
        title: "Folder",
        createdAt: 2,
        children: [
          {
            type: "item",
            id: "new",
            title: "New",
            url: "https://new.example",
            createdAt: 3,
          },
          {
            type: "item",
            id: "new-duplicate",
            title: "New duplicate",
            url: "https://new.example",
            createdAt: 4,
          },
        ],
      },
    ],
  },
];

describe("collectNewBookmarkShortcuts", () => {
  it("filters URLs already anywhere in the bookmark tree and shortcut duplicates", () => {
    const result = collectNewBookmarkShortcuts(categories, [
      {
        id: "root",
        title: "",
        syncing: false,
        children: [
          {
            id: "nested",
            title: "Nested",
            syncing: false,
            children: [
              {
                id: "bookmark",
                title: "Existing",
                url: "https://existing.example",
                syncing: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(result.newItems.map((item) => item.url)).toEqual([
      "https://new.example",
    ]);
    expect(result.skippedDuplicateCount).toBe(2);
  });

  it("keeps valid web URLs and ignores unsupported or malformed URLs", () => {
    const result = collectNewBookmarkShortcuts(
      [
        {
          id: "home",
          name: "Home",
          shortcuts: [
            {
              type: "item",
              id: "uppercase-protocol",
              title: "Uppercase protocol",
              url: "HTTPS://example.com/path",
              createdAt: 1,
            },
            {
              type: "item",
              id: "browser-page",
              title: "Browser page",
              url: "chrome://settings",
              createdAt: 2,
            },
            {
              type: "item",
              id: "malformed",
              title: "Malformed",
              url: "https://",
              createdAt: 3,
            },
          ],
        },
      ],
      [],
    );

    expect(result.newItems.map((item) => item.url)).toEqual([
      "HTTPS://example.com/path",
    ]);
    expect(result.skippedDuplicateCount).toBe(0);
  });
});
