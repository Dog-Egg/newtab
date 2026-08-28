import { describe, expect, it, vi } from "vitest";
import type { Platform } from "../platform/types";
import type { BrowserBookmarkFolder } from "./bookmarkTree";
import { deleteFolderKeepingContents } from "./folderDeletion";

describe("deleteFolderKeepingContents", () => {
  it("moves direct children to the folder position in order before deleting it", async () => {
    const move = vi.fn<Platform["bookmarks"]["move"]>(
      async (id, destination) => ({
        type: "item",
        id,
        title: id,
        url: `https://${id}.example.com`,
        parentId: destination.parentId,
        index: destination.index,
      }),
    );
    const remove = vi.fn<Platform["bookmarks"]["remove"]>(async () => {});
    const folder: BrowserBookmarkFolder = {
      type: "folder",
      id: "folder",
      title: "Folder",
      parentId: "parent",
      index: 2,
      children: [
        {
          type: "item",
          id: "first",
          title: "First",
          url: "https://first.example.com",
          parentId: "folder",
          index: 0,
        },
        {
          type: "folder",
          id: "nested",
          title: "Nested",
          parentId: "folder",
          index: 1,
          children: [],
        },
      ],
    };

    await deleteFolderKeepingContents({ move, remove }, folder);

    expect(move).toHaveBeenNthCalledWith(1, "first", {
      parentId: "parent",
      index: 2,
    });
    expect(move).toHaveBeenNthCalledWith(2, "nested", {
      parentId: "parent",
      index: 3,
    });
    expect(remove).toHaveBeenCalledWith("folder");
    expect(move.mock.invocationCallOrder[1]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
  });
});
