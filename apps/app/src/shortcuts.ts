export type ShortcutItem = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type ShortcutNode = ShortcutItem;
export type Shortcut = ShortcutItem;

export const SHORTCUTS_STORAGE_KEY = "shortcuts";

function normalizeShortcutItem(value: unknown): ShortcutItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shortcut = value as Partial<ShortcutItem>;
  if (
    typeof shortcut.id !== "string" ||
    typeof shortcut.title !== "string" ||
    typeof shortcut.url !== "string" ||
    typeof shortcut.createdAt !== "number"
  ) {
    return null;
  }

  return {
    id: shortcut.id,
    title: shortcut.title,
    url: shortcut.url,
    createdAt: shortcut.createdAt,
  };
}

export function normalizeShortcuts(value: unknown): ShortcutNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const shortcut = normalizeShortcutItem(item);
    return shortcut ? [shortcut] : [];
  });
}
