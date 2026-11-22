import type { Platform } from "./types";
import {
  BOOKMARK_USAGE_MESSAGE_TYPES,
  type BookmarkUsageMessage,
} from "../bookmarks/bookmark-usage-messages";

async function requestBookmarkUsage(message: BookmarkUsageMessage) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.error)
    throw new Error(response?.error ?? "No bookmark usage response");
  return response;
}

export const chromeBookmarkUsage: Platform["bookmarkUsage"] = {
  read: async () => {
    const response = await requestBookmarkUsage({
      type: BOOKMARK_USAGE_MESSAGE_TYPES.read,
    });
    return response.usage;
  },
  record: async (bookmarkId) => {
    await requestBookmarkUsage({
      type: BOOKMARK_USAGE_MESSAGE_TYPES.record,
      bookmarkId,
    });
  },
};
