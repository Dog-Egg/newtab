import { describe, expect, it } from "vitest";
import { browserBookmarkTreeSchema } from "./schema";

describe("browserBookmarkTreeSchema", () => {
  it("returns an empty tree when the stored value is not an array", () => {
    expect(browserBookmarkTreeSchema.parse(undefined)).toEqual([]);
    expect(browserBookmarkTreeSchema.parse({})).toEqual([]);
  });

  it("discards invalid nodes while preserving valid descendants", () => {
    expect(
      browserBookmarkTreeSchema.parse([
        null,
        {
          type: "folder",
          id: "root",
          title: "Root",
          folderType: "invalid",
          children: [
            { type: "item", id: "", title: "Invalid", url: "invalid" },
            {
              type: "item",
              id: "valid",
              title: "Valid",
              url: "https://example.com",
              index: "invalid",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        type: "folder",
        id: "root",
        title: "Root",
        folderType: undefined,
        children: [
          {
            type: "item",
            id: "valid",
            title: "Valid",
            url: "https://example.com",
            index: undefined,
          },
        ],
      },
    ]);
  });
});
