import type { BrowserBookmarkItem } from "../../bookmarks/bookmark-tree";
import {
  BOOKMARK_USAGE_HALF_LIFE_MS,
  type BookmarkUsage,
} from "../../bookmarks/bookmark-usage";

export function rankBookmarks(
  bookmarks: BrowserBookmarkItem[],
  usage: BookmarkUsage,
): BrowserBookmarkItem[] {
  // All scores decay at the same rate. Compare in log space at a common
  // reference time to retain ordering even after years without clicks.
  const reference = Object.values(usage.entries).reduce(
    (latest, entry) => Math.max(latest, entry.lastUpdated),
    0,
  );
  return bookmarks
    .flatMap((bookmark) => {
      const entry = Object.prototype.hasOwnProperty.call(
        usage.entries,
        bookmark.id,
      )
        ? usage.entries[bookmark.id]
        : undefined;
      return entry
        ? [
            {
              bookmark,
              entry,
              weight:
                Math.log2(entry.score) +
                (entry.lastUpdated - reference) / BOOKMARK_USAGE_HALF_LIFE_MS,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        b.entry.lastUpdated - a.entry.lastUpdated ||
        (a.bookmark.id < b.bookmark.id
          ? -1
          : a.bookmark.id > b.bookmark.id
            ? 1
            : 0),
    )
    .slice(0, 10)
    .map(({ bookmark }) => bookmark);
}
