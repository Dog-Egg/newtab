import * as z from "zod/mini";

/** 旧数据中缺少 type 的书签项也需要继续支持。 */
const legacyShortcutItemSchema = z.pipe(
  z.object({
    type: z.optional(z.literal("item")),
    id: z.string(),
    title: z.string(),
    url: z.string(),
    createdAt: z.number(),
  }),
  z.transform(({ id, title, url, createdAt }) => ({
    type: "item" as const,
    id,
    title,
    url,
    createdAt,
  })),
);

const optionalLegacyShortcutItemSchema = z.catch(
  z.optional(legacyShortcutItemSchema),
  undefined,
);

const legacyShortcutFolderSchema = z.object({
  type: z.literal("folder"),
  id: z.string(),
  title: z.string(),
  children: z.pipe(
    z.array(optionalLegacyShortcutItemSchema),
    z.transform((items) =>
      items.flatMap((item) => (item === undefined ? [] : [item])),
    ),
  ),
  createdAt: z.number(),
});

const legacyShortcutNodeSchema = z.union([
  legacyShortcutFolderSchema,
  legacyShortcutItemSchema,
]);

const legacyShortcutsSchema = z.catch(
  z.pipe(
    z.array(z.catch(z.optional(legacyShortcutNodeSchema), undefined)),
    z.transform((nodes) =>
      nodes.flatMap((node) => (node === undefined ? [] : [node])),
    ),
  ),
  [],
);

const legacyLauncherCategorySchema = z.object({
  id: z.string(),
  name: z.string().check(z.trim(), z.minLength(1)),
  shortcuts: legacyShortcutsSchema,
});

export const LAUNCHER_STORAGE_KEY = "launcher";

/**
 * 旧 `launcher` 存储结构，仅用于 Extension 的一次性迁移。
 * 字段名 `shortcuts` 必须保持不变，才能读取已经发布版本写入的数据。
 */
export const legacyLauncherSchema = z.catch(
  z.pipe(
    z.array(z.catch(z.optional(legacyLauncherCategorySchema), undefined)),
    z.transform((categories) =>
      categories
        .flatMap((category) => (category === undefined ? [] : [category]))
        .filter(
          (category, index, all) =>
            all.findIndex((candidate) => candidate.id === category.id) ===
            index,
        ),
    ),
  ),
  [],
);

export type LegacyShortcutItem = z.infer<typeof legacyShortcutItemSchema>;
export type LegacyShortcutNode = z.infer<typeof legacyShortcutNodeSchema>;
export type LegacyLauncherCategory = z.infer<
  typeof legacyLauncherCategorySchema
>;
