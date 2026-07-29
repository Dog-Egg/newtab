import { describe, expect, it } from "vitest";
import { getBookmarkReorderDestination } from "./bookmarkDrag";

describe("getBookmarkReorderDestination", () => {
  it("uses the sortable source final index without requiring a drop target", () => {
    expect(
      getBookmarkReorderDestination({ initialIndex: 0, index: 2 }, "folder"),
    ).toEqual({ parentId: "folder", index: 2 });
  });

  it("does not write an unchanged order back to the browser", () => {
    expect(
      getBookmarkReorderDestination({ initialIndex: 1, index: 1 }, "folder"),
    ).toBeNull();
  });
});
