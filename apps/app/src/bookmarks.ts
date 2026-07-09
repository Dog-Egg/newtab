export type BookmarkItem = {
  type: "bookmark";
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type BookmarkFolder = {
  type: "folder";
  id: string;
  title: string;
  createdAt: number;
  children: BookmarkItem[];
};

export type BookmarkNode = BookmarkItem | BookmarkFolder;
export type Bookmark = BookmarkItem;

export const BOOKMARKS_STORAGE_KEY = "bookmarks";

export const DEMO_BOOKMARKS: BookmarkNode[] = [
  {
    type: "bookmark",
    id: "https://trello.com",
    title: "Trello",
    url: "https://trello.com",
    createdAt: 1,
  },
  {
    type: "bookmark",
    id: "https://home.mi.com",
    title: "米家",
    url: "https://home.mi.com",
    createdAt: 2,
  },
  {
    type: "folder",
    id: "folder-finance-demo",
    title: "财务",
    createdAt: 3,
    children: [
      {
        type: "bookmark",
        id: "https://cmbchina.com",
        title: "招商银行",
        url: "https://cmbchina.com",
        createdAt: 3,
      },
    ],
  },
  {
    type: "bookmark",
    id: "https://pan.baidu.com",
    title: "百度网盘",
    url: "https://pan.baidu.com",
    createdAt: 4,
  },
  {
    type: "folder",
    id: "folder-tools-demo",
    title: "实用工具",
    createdAt: 5,
    children: [
      {
        type: "bookmark",
        id: "https://10010.com",
        title: "联通",
        url: "https://10010.com",
        createdAt: 5,
      },
    ],
  },
  {
    type: "folder",
    id: "folder-travel-demo",
    title: "旅行",
    createdAt: 6,
    children: [
      {
        type: "bookmark",
        id: "https://trip.com",
        title: "Trip",
        url: "https://trip.com",
        createdAt: 6,
      },
      {
        type: "bookmark",
        id: "https://ctrip.com",
        title: "携程",
        url: "https://ctrip.com",
        createdAt: 7,
      },
    ],
  },
  {
    type: "bookmark",
    id: "https://1password.com",
    title: "1Password",
    url: "https://1password.com",
    createdAt: 8,
  },
  {
    type: "bookmark",
    id: "https://www.xiachufang.com",
    title: "下厨房",
    url: "https://www.xiachufang.com",
    createdAt: 9,
  },
];

function normalizeBookmarkItem(value: unknown): BookmarkItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const bookmark = value as Partial<BookmarkItem> & { type?: unknown };
  if (
    typeof bookmark.id !== "string" ||
    typeof bookmark.title !== "string" ||
    typeof bookmark.url !== "string" ||
    typeof bookmark.createdAt !== "number"
  ) {
    return null;
  }

  return {
    type: "bookmark",
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    createdAt: bookmark.createdAt,
  };
}

export function normalizeBookmarks(value: unknown): BookmarkNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): BookmarkNode[] => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const node = item as Partial<BookmarkFolder> & { type?: unknown };
    if (node.type === "folder") {
      const children = Array.isArray(node.children)
        ? node.children.flatMap((child) => {
            const bookmark = normalizeBookmarkItem(child);
            return bookmark ? [bookmark] : [];
          })
        : [];

      if (
        typeof node.id !== "string" ||
        typeof node.title !== "string" ||
        typeof node.createdAt !== "number"
      ) {
        return [];
      }

      return [
        {
          type: "folder",
          id: node.id,
          title: node.title,
          createdAt: node.createdAt,
          children,
        },
      ];
    }

    const bookmark = normalizeBookmarkItem(item);
    return bookmark ? [bookmark] : [];
  });
}
