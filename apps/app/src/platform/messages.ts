import * as z from "zod/mini";

export const BOOKMARK_USAGE_MESSAGE_TYPES = {
  read: "bookmark-usage:read",
  record: "bookmark-usage:record",
} as const;

export const bookmarkUsageMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(BOOKMARK_USAGE_MESSAGE_TYPES.read) }),
  z.object({
    type: z.literal(BOOKMARK_USAGE_MESSAGE_TYPES.record),
    bookmarkId: z.string(),
  }),
]);

export type BookmarkUsageMessage = z.infer<typeof bookmarkUsageMessageSchema>;
