import type { Platform } from "../platform/types";
import type { BrowserBookmarkFolder } from "./bookmarkTree";

type BookmarkMutations = Pick<Platform["bookmarks"], "move" | "remove">;

export async function deleteFolderKeepingContents(
  bookmarks: BookmarkMutations,
  folder: BrowserBookmarkFolder,
) {
  if (!folder.parentId) {
    throw new Error(`Cannot delete bookmark root folder: ${folder.id}`);
  }

  const folderIndex = folder.index ?? 0;
  for (const [childIndex, child] of folder.children.entries()) {
    // 每移出一个子节点，原文件夹会向后顺延；连续插入 folderIndex + childIndex
    // 可以让全部内容在删除文件夹后准确占据它原来的位置，并保持原有顺序。
    await bookmarks.move(child.id, {
      parentId: folder.parentId,
      index: folderIndex + childIndex,
    });
  }

  // 子文件夹作为一个节点移动，其内部的任意深度结构都会由浏览器完整保留。
  await bookmarks.remove(folder.id);
}
