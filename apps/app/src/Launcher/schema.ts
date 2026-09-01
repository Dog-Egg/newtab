import type { BrowserBookmarkNode } from "./bookmarkTree";

import * as z from "zod/mini";

const optionalParentIdSchema = z.catch(z.optional(z.string()), undefined);
const optionalIndexSchema = z.catch(z.optional(z.number()), undefined);
const optionalUnmodifiableSchema = z.catch(
  z.optional(z.literal("managed")),
  undefined,
);

const bookmarkItemSchema = z.object({
  type: z.literal("item"),
  id: z.string().check(z.minLength(1)),
  title: z.string(),
  url: z.string(),
  parentId: optionalParentIdSchema,
  index: optionalIndexSchema,
  unmodifiable: optionalUnmodifiableSchema,
});

function discardInvalidNodes(nodes: (BrowserBookmarkNode | undefined)[]) {
  return nodes.flatMap((node) => (node === undefined ? [] : [node]));
}

const browserBookmarkNodeSchema: z.ZodMiniType<BrowserBookmarkNode> = z.lazy(
  () =>
    z.discriminatedUnion("type", [
      bookmarkItemSchema,
      z.object({
        type: z.literal("folder"),
        id: z.string().check(z.minLength(1)),
        title: z.string(),
        parentId: optionalParentIdSchema,
        index: optionalIndexSchema,
        folderType: z.catch(
          z.optional(z.enum(["bookmarks-bar", "other", "mobile", "managed"])),
          undefined,
        ),
        unmodifiable: optionalUnmodifiableSchema,
        children: z.pipe(
          z.array(z.catch(z.optional(browserBookmarkNodeSchema), undefined)),
          z.transform(discardInvalidNodes),
        ),
      }),
    ]),
);

export const browserBookmarkTreeSchema = z.catch(
  z.pipe(
    z.array(z.catch(z.optional(browserBookmarkNodeSchema), undefined)),
    z.transform(discardInvalidNodes),
  ),
  [],
);
