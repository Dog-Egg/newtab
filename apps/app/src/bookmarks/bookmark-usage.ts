import * as z from "zod/mini";
import {
  flattenBookmarkItems,
  type BrowserBookmarkItem,
  type BrowserBookmarkNode,
} from "./bookmark-tree";

export const BOOKMARK_USAGE_KEY = "bookmark-usage";
export const BOOKMARK_USAGE_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

const bookmarkUsageEntrySchema = z.object({
  score: z.number().check(z.gt(0)),
  lastUpdated: z.number().check(z.gte(0)),
});

const bookmarkUsageSchema = z.catch(
  z.object({
    version: z.literal(1),
    entries: z.pipe(
      z.record(
        z.string(),
        z.catch(z.optional(bookmarkUsageEntrySchema), undefined),
      ),
      z.transform((entries) =>
        Object.fromEntries(
          Object.entries(entries).flatMap(([id, entry]) =>
            entry === undefined ? [] : [[id, entry]],
          ),
        ),
      ),
    ),
  }),
  { version: 1, entries: {} },
);

export type BookmarkUsage = z.infer<typeof bookmarkUsageSchema>;

export function parseBookmarkUsage(value: unknown): BookmarkUsage {
  return bookmarkUsageSchema.parse(value);
}

export function recordBookmarkUsage(
  usage: BookmarkUsage,
  bookmark: Pick<BrowserBookmarkItem, "id">,
  now: number,
): BookmarkUsage {
  const previous = Object.prototype.hasOwnProperty.call(
    usage.entries,
    bookmark.id,
  )
    ? usage.entries[bookmark.id]
    : undefined;
  // A backwards system clock must not amplify an existing score.
  const lastUpdated = Math.max(now, previous?.lastUpdated ?? 0);
  const score = previous
    ? previous.score *
        2 **
          (-(lastUpdated - previous.lastUpdated) /
            BOOKMARK_USAGE_HALF_LIFE_MS) +
      1
    : 1;
  return {
    version: 1,
    entries: { ...usage.entries, [bookmark.id]: { score, lastUpdated } },
  };
}

export function reconcileBookmarkUsage(
  usage: BookmarkUsage,
  bookmarks: BrowserBookmarkItem[],
): BookmarkUsage {
  const ids = new Set(bookmarks.map((bookmark) => bookmark.id));
  const entries = Object.fromEntries(
    Object.entries(usage.entries).filter(([id]) => ids.has(id)),
  );
  return Object.keys(entries).length === Object.keys(usage.entries).length
    ? usage
    : { version: 1, entries };
}

export function updateBookmarkUsage(
  stored: BookmarkUsage,
  tree: BrowserBookmarkNode[],
  bookmarkId?: string,
): BookmarkUsage {
  const bookmarks = flattenBookmarkItems(tree);
  const reconciled = reconcileBookmarkUsage(stored, bookmarks);
  const bookmark = bookmarks.find((item) => item.id === bookmarkId);
  return bookmark
    ? recordBookmarkUsage(reconciled, bookmark, Date.now())
    : reconciled;
}
