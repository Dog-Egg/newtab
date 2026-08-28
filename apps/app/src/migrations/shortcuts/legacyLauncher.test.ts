import { describe, expect, it } from "vitest";
import { normalizeLegacyLauncher } from "./legacyLauncher";

describe("normalizeLegacyLauncher", () => {
  it("returns no categories for a fresh extension profile", () => {
    expect(normalizeLegacyLauncher(undefined)).toEqual([]);
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

    expect(normalizeLegacyLauncher(stored)).toEqual(stored);
  });
});
