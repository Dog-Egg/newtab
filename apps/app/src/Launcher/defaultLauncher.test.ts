import { describe, expect, it } from "vitest";
import { normalizeStoredExtensionLauncher } from "./defaultLauncher";

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
            type: "item",
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
