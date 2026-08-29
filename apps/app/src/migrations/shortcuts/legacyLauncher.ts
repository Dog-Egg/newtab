/**
 * 旧 `launcher` 存储结构，仅用于 Extension 的一次性迁移。
 * 字段名 `shortcuts` 必须保持不变，才能读取已经发布版本写入的数据。
 */
export type LegacyShortcutItem = {
  type: "item";
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

type LegacyShortcutFolder = {
  type: "folder";
  id: string;
  title: string;
  children: LegacyShortcutItem[];
  createdAt: number;
};

export type LegacyShortcutNode = LegacyShortcutItem | LegacyShortcutFolder;

function normalizeLegacyShortcutItem(
  value: unknown,
): LegacyShortcutItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shortcut = value as Partial<LegacyShortcutItem>;
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

function normalizeLegacyShortcutFolder(
  value: unknown,
): LegacyShortcutFolder | null {
  if (!value || typeof value !== "object") return null;

  const folder = value as Partial<LegacyShortcutFolder>;
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
    const item = normalizeLegacyShortcutItem(value);
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

/** 丢弃损坏节点，同时保留可迁移的旧 Launcher 数据。 */
function normalizeLegacyShortcuts(value: unknown): LegacyShortcutNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap<LegacyShortcutNode>((item) => {
    const folder = normalizeLegacyShortcutFolder(item);
    if (folder) return [folder];

    const shortcut = normalizeLegacyShortcutItem(item);
    return shortcut ? [shortcut] : [];
  });
}

export type LegacyLauncherCategory = {
  id: string;
  name: string;
  shortcuts: LegacyShortcutNode[];
};

export const LAUNCHER_STORAGE_KEY = "launcher";

export function normalizeLegacyLauncher(
  value: unknown,
): LegacyLauncherCategory[] {
  if (!Array.isArray(value)) return [];

  const categories = value.flatMap<LegacyLauncherCategory>((item) => {
    if (!item || typeof item !== "object") return [];
    const category = item as Partial<LegacyLauncherCategory>;
    return typeof category.id === "string" &&
      typeof category.name === "string" &&
      category.name.trim()
      ? [
          {
            id: category.id,
            name: category.name.trim(),
            shortcuts: normalizeLegacyShortcuts(category.shortcuts),
          },
        ]
      : [];
  });

  const uniqueCategories = categories.filter(
    (category, index, all) =>
      all.findIndex((candidate) => candidate.id === category.id) === index,
  );
  return uniqueCategories;
}
