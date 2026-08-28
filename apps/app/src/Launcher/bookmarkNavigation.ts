import { findBookmarkPath, type BrowserBookmarkFolder } from "./bookmarkTree";

export type BookmarkRevealDestination = {
  rootId: string;
  folderId: string | null;
};

export function findBookmarkRevealDestination(
  roots: BrowserBookmarkFolder[],
  bookmarkId: string,
): BookmarkRevealDestination | null {
  const path = findBookmarkPath(roots, bookmarkId);
  const root = path?.[0];
  const bookmark = path?.[path.length - 1];
  const parentFolder = path?.[path.length - 2];
  if (
    root?.type !== "folder" ||
    bookmark?.type !== "item" ||
    parentFolder?.type !== "folder"
  ) {
    return null;
  }

  return {
    rootId: root.id,
    folderId: parentFolder.id === root.id ? null : parentFolder.id,
  };
}
