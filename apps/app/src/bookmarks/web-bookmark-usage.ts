import { webLocalStorage } from "../platform/web-storage";
import {
  BOOKMARK_USAGE_KEY,
  parseBookmarkUsage,
  updateBookmarkUsage,
} from "./bookmark-usage";
import { readStoredWebBookmarks } from "./web-bookmarks";

function updateUsage(bookmarkId?: string) {
  const stored = parseBookmarkUsage(webLocalStorage.read(BOOKMARK_USAGE_KEY));
  const next = updateBookmarkUsage(
    stored,
    readStoredWebBookmarks(),
    bookmarkId,
  );
  if (next !== stored) webLocalStorage.write(BOOKMARK_USAGE_KEY, next);
  return next;
}

export const webBookmarkUsage = {
  read: async () => updateUsage(),
  record: async (bookmarkId: string) => {
    updateUsage(bookmarkId);
  },
};
