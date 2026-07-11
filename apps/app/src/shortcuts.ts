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

export const SHORTCUTS_STORAGE_KEY = "shortcuts";

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
    title: "文件夹",
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
