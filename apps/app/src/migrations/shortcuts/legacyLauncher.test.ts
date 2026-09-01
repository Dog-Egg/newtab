import { describe, expect, it } from "vitest";
import { legacyLauncherSchema } from "./legacyLauncher";

describe("legacyLauncherSchema", () => {
  it("returns no categories for a fresh extension profile", () => {
    expect(legacyLauncherSchema.parse(undefined)).toEqual([]);
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

    expect(legacyLauncherSchema.parse(stored)).toEqual(stored);
  });

  it("keeps valid legacy data while discarding damaged entries", () => {
    expect(
      legacyLauncherSchema.parse([
        null,
        {
          id: "default",
          name: "  Saved  ",
          shortcuts: [
            {
              id: "old",
              title: "Old item",
              url: "https://example.com",
              createdAt: 1,
            },
            { type: "item", id: "invalid" },
          ],
        },
        { id: "default", name: "Duplicate", shortcuts: [] },
      ]),
    ).toEqual([
      {
        id: "default",
        name: "Saved",
        shortcuts: [
          {
            type: "item",
            id: "old",
            title: "Old item",
            url: "https://example.com",
            createdAt: 1,
          },
        ],
      },
    ]);
  });
});
