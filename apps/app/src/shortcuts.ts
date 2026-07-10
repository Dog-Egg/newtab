export type ShortcutItem = {
  type: "shortcut";
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type ShortcutNode = ShortcutItem;
export type Shortcut = ShortcutItem;

export const SHORTCUTS_STORAGE_KEY = "shortcuts";

export const DEMO_SHORTCUTS: ShortcutNode[] = [
  {
    type: "shortcut",
    id: "https://trello.com",
    title: "Trello",
    url: "https://trello.com",
    createdAt: 1,
  },
  {
    type: "shortcut",
    id: "https://home.mi.com",
    title: "米家",
    url: "https://home.mi.com",
    createdAt: 2,
  },
  {
    type: "shortcut",
    id: "https://cmbchina.com",
    title: "招商银行",
    url: "https://cmbchina.com",
    createdAt: 3,
  },
  {
    type: "shortcut",
    id: "https://pan.baidu.com",
    title: "百度网盘",
    url: "https://pan.baidu.com",
    createdAt: 4,
  },
  {
    type: "shortcut",
    id: "https://10010.com",
    title: "联通",
    url: "https://10010.com",
    createdAt: 5,
  },
  {
    type: "shortcut",
    id: "https://trip.com",
    title: "Trip",
    url: "https://trip.com",
    createdAt: 6,
  },
  {
    type: "shortcut",
    id: "https://ctrip.com",
    title: "携程",
    url: "https://ctrip.com",
    createdAt: 7,
  },
  {
    type: "shortcut",
    id: "https://1password.com",
    title: "1Password",
    url: "https://1password.com",
    createdAt: 8,
  },
  {
    type: "shortcut",
    id: "https://www.xiachufang.com",
    title: "下厨房",
    url: "https://www.xiachufang.com",
    createdAt: 9,
  },
];

function normalizeShortcutItem(value: unknown): ShortcutItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shortcut = value as Partial<ShortcutItem> & { type?: unknown };
  if (
    typeof shortcut.id !== "string" ||
    typeof shortcut.title !== "string" ||
    typeof shortcut.url !== "string" ||
    typeof shortcut.createdAt !== "number"
  ) {
    return null;
  }

  return {
    type: "shortcut",
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
