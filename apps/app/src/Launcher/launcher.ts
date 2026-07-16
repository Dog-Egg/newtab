export type ShortcutItem = {
  type: "item";
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type ShortcutFolder = {
  type: "folder";
  id: string;
  title: string;
  children: ShortcutItem[];
  createdAt: number;
};

// 文件夹暂时只允许包含快捷方式，不允许嵌套文件夹。这个约束让拖拽语义保持简单，
// 以后需要嵌套时，只需把 children 改成 ShortcutNode[] 并补上递归操作即可。
export type ShortcutNode = ShortcutItem | ShortcutFolder;
export type Shortcut = ShortcutItem;

function normalizeShortcutItem(value: unknown): ShortcutItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shortcut = value as Partial<ShortcutItem>;
  if (
    // type 缺失表示这是升级前保存的旧数据，需要在读取时自动迁移。
    (shortcut.type !== undefined && shortcut.type !== "item") ||
    typeof shortcut.id !== "string" ||
    typeof shortcut.title !== "string" ||
    typeof shortcut.url !== "string" ||
    typeof shortcut.createdAt !== "number"
  ) {
    return null;
  }

  return {
    type: "item",
    id: shortcut.id,
    title: shortcut.title,
    url: shortcut.url,
    createdAt: shortcut.createdAt,
  };
}

function normalizeShortcutFolder(value: unknown): ShortcutFolder | null {
  if (!value || typeof value !== "object") return null;

  const folder = value as Partial<ShortcutFolder>;
  if (
    folder.type !== "folder" ||
    typeof folder.id !== "string" ||
    typeof folder.title !== "string" ||
    typeof folder.createdAt !== "number" ||
    !Array.isArray(folder.children)
  ) {
    return null;
  }

  // 丢弃损坏的子项，而不是让一个坏书签导致整个文件夹无法显示。
  const children = folder.children.flatMap((value) => {
    const item = normalizeShortcutItem(value);
    return item ? [item] : [];
  });

  return {
    type: "folder",
    id: folder.id,
    title: folder.title,
    createdAt: folder.createdAt,
    children,
  };
}

/**
 * 把顶层 Item 合并到另一个节点：目标是 Item 时新建文件夹，目标是 Folder
 * 时把 Item 追加到该文件夹。目标节点始终保持原来的顶层位置。
 */
export function mergeShortcutIntoNode(
  nodes: ShortcutNode[],
  sourceId: string,
  targetId: string,
  folderId: string,
  createdAt = Date.now(),
  folderTitle = "Folder",
): ShortcutNode[] {
  if (sourceId === targetId) return nodes;

  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (source?.type !== "item" || !target) return nodes;

  if (target.type === "folder") {
    return nodes.flatMap((node) => {
      if (node.id === sourceId) return [];
      if (node.id !== targetId) return [node];

      return [{ ...target, children: [...target.children, source] }];
    });
  }

  const targetIndex = nodes.indexOf(target);
  const sourceWasBeforeTarget = nodes.indexOf(source) < targetIndex;
  const remaining = nodes.filter(
    (node) => node.id !== sourceId && node.id !== targetId,
  );
  const folder: ShortcutFolder = {
    type: "folder",
    id: folderId,
    title: folderTitle,
    children: [target, source],
    createdAt,
  };

  // 删除 source 后，位于其后方的 target 索引会左移一位。
  const insertionIndex = targetIndex - (sourceWasBeforeTarget ? 1 : 0);
  return [
    ...remaining.slice(0, insertionIndex),
    folder,
    ...remaining.slice(insertionIndex),
  ];
}

/** dnd-kit 的 move() 支持 Record<groupId, items[]> 形式的多组排序数据。 */
export type ShortcutSortableGroups = Record<string, ShortcutNode[]>;

/**
 * 把持久化使用的树形结构投影成 dnd-kit 可直接排序的 group Record。
 * rootGroup 保存主页节点，每个 Folder ID 对应它自己的 children group。
 */
export function createShortcutSortableGroups(
  nodes: ShortcutNode[],
  rootGroup: string,
): ShortcutSortableGroups {
  const groups: ShortcutSortableGroups = { [rootGroup]: nodes };
  for (const node of nodes) {
    if (node.type === "folder") groups[node.id] = node.children;
  }
  return groups;
}

/**
 * 把 move() 产生的 group Record 还原成存储层需要的 ShortcutNode[]。
 * 空 Folder 会被移除，避免 Item 全部移出后留下不可操作的空壳。
 */
export function resolveShortcutSortableGroups(
  groups: ShortcutSortableGroups,
  rootGroup: string,
): ShortcutNode[] {
  return (groups[rootGroup] ?? []).flatMap<ShortcutNode>((node) => {
    if (node.type === "item") return [node];

    const children = (groups[node.id] ?? []).filter(
      (child): child is ShortcutItem => child.type === "item",
    );
    return children.length ? [{ ...node, children }] : [];
  });
}

export function normalizeShortcuts(value: unknown): ShortcutNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap<ShortcutNode>((item) => {
    const folder = normalizeShortcutFolder(item);
    if (folder) return [folder];

    const shortcut = normalizeShortcutItem(item);
    return shortcut ? [shortcut] : [];
  });
}

export type ShortcutCategory = {
  id: string;
  name: string;
  shortcuts: ShortcutNode[];
};

export const LAUNCHER_STORAGE_KEY = "launcher";
export const ACTIVE_CATEGORY_ID_STORAGE_KEY = "activeCategoryId";

export const DEFAULT_CATEGORY_ID = "default";

export function normalizeLauncher(
  value: unknown,
  defaultCategory: ShortcutCategory,
): ShortcutCategory[] {
  if (!Array.isArray(value)) return [defaultCategory];

  const categories = value.flatMap<ShortcutCategory>((item) => {
    if (!item || typeof item !== "object") return [];
    const category = item as Partial<ShortcutCategory>;
    return typeof category.id === "string" &&
      typeof category.name === "string" &&
      category.name.trim()
      ? [
          {
            id: category.id,
            name: category.name.trim(),
            shortcuts: normalizeShortcuts(category.shortcuts),
          },
        ]
      : [];
  });

  const uniqueCategories = categories.filter(
    (category, index, all) =>
      all.findIndex((candidate) => candidate.id === category.id) === index,
  );
  const hasDefault = uniqueCategories.some(
    (category) => category.id === DEFAULT_CATEGORY_ID,
  );
  return hasDefault ? uniqueCategories : [defaultCategory, ...uniqueCategories];
}

export function normalizeActiveCategoryId(
  value: unknown,
  categories: ShortcutCategory[],
) {
  return typeof value === "string" &&
    categories.some((category) => category.id === value)
    ? value
    : DEFAULT_CATEGORY_ID;
}
