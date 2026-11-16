import { flattenBookmarkItems } from "../launcher/bookmark-tree";
import {
  BOOKMARK_USAGE_KEY,
  parseBookmarkUsage,
  reconcileBookmarkUsage,
  recordBookmarkUsage,
} from "../launcher/bookmark-usage";
import {
  BOOKMARK_USAGE_MESSAGE_TYPES,
  bookmarkUsageMessageSchema,
} from "../platform/messages";
import { getBookmarkTree } from "../platform/chrome-bookmarks";
import { getChromeStorage, setChromeStorage } from "../platform/chrome-storage";

// One writer serializes clicks from all new tabs, including bookmark cleanup.
let pending: Promise<unknown> = Promise.resolve();
function updateUsage(bookmarkId?: string) {
  const operation = pending.then(async () => {
    const bookmarks = flattenBookmarkItems(await getBookmarkTree());
    const stored = parseBookmarkUsage(
      await getChromeStorage(BOOKMARK_USAGE_KEY),
    );
    let next = reconcileBookmarkUsage(stored, bookmarks);
    const bookmark = bookmarks.find((item) => item.id === bookmarkId);
    if (bookmark) next = recordBookmarkUsage(next, bookmark, Date.now());
    if (next !== stored) await setChromeStorage(BOOKMARK_USAGE_KEY, next);
    return next;
  });
  pending = operation.catch(() => {});
  return operation;
}

export function registerBookmarkUsage() {
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      const result = bookmarkUsageMessageSchema.safeParse(message);
      if (!result.success) return;
      const request = result.data;
      void updateUsage(
        request.type === BOOKMARK_USAGE_MESSAGE_TYPES.record
          ? request.bookmarkId
          : undefined,
      ).then(
        (usage) =>
          sendResponse(
            request.type === BOOKMARK_USAGE_MESSAGE_TYPES.read
              ? { usage }
              : { success: true },
          ),
        (error: unknown) =>
          sendResponse({
            error: error instanceof Error ? error.message : String(error),
          }),
      );
      return true;
    },
  );
  const cleanup = () => {
    void updateUsage().catch((error: unknown) =>
      console.error("Failed to clean bookmark usage", error),
    );
  };
  chrome.bookmarks.onRemoved.addListener(cleanup);
}
