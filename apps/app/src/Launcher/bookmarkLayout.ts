export const ACTIVE_CATEGORY_ID_STORAGE_KEY = "activeCategoryId";
export const DEFAULT_CATEGORY_ID = "default";

export function normalizeActiveCategoryId(
  value: unknown,
  categories: Array<{ id: string }>,
) {
  return typeof value === "string" &&
    categories.some((category) => category.id === value)
    ? value
    : DEFAULT_CATEGORY_ID;
}

export const BOOKMARK_LAYOUT_STORAGE_KEY = "bookmark-layout";

/** 持久化层只保存 Chrome bookmark ID；标题和 URL 始终以浏览器数据为准。 */
export type BookmarkLayoutItem = {
  type: "item";
  id: string;
};

export type BookmarkLayoutFolder = {
  type: "folder";
  id: string;
  title: string;
  children: BookmarkLayoutItem[];
};

export type BookmarkLayoutNode = BookmarkLayoutItem | BookmarkLayoutFolder;

export type BookmarkLayoutCategory = {
  id: string;
  name: string;
  bookmarks: BookmarkLayoutNode[];
};

/** Launcher 渲染使用的书签实体，由 layout 与 chrome.bookmarks 在内存中合并而来。 */
export type LauncherBookmarkItem = BookmarkLayoutItem & {
  title: string;
  url: string;
};

export type LauncherBookmarkFolder = Omit<BookmarkLayoutFolder, "children"> & {
  children: LauncherBookmarkItem[];
};

export type LauncherBookmarkNode =
  LauncherBookmarkItem | LauncherBookmarkFolder;

export type LauncherBookmarkCategory = Omit<
  BookmarkLayoutCategory,
  "bookmarks"
> & {
  bookmarks: LauncherBookmarkNode[];
};

export type BrowserBookmark = {
  id: string;
  title: string;
  url: string;
};

function normalizeLayoutItem(value: unknown): BookmarkLayoutItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<BookmarkLayoutItem>;
  return item.type === "item" && typeof item.id === "string" && item.id
    ? { type: "item", id: item.id }
    : null;
}

function normalizeLayoutFolder(value: unknown): BookmarkLayoutFolder | null {
  if (!value || typeof value !== "object") return null;
  const folder = value as Partial<BookmarkLayoutFolder>;
  if (
    folder.type !== "folder" ||
    typeof folder.id !== "string" ||
    !folder.id ||
    typeof folder.title !== "string" ||
    !Array.isArray(folder.children)
  ) {
    return null;
  }

  return {
    type: "folder",
    id: folder.id,
    title: folder.title,
    children: folder.children.flatMap((child) => {
      const item = normalizeLayoutItem(child);
      return item ? [item] : [];
    }),
  };
}

export function createDefaultBookmarkLayout(
  defaultCategoryName: string,
): BookmarkLayoutCategory[] {
  return [
    {
      id: DEFAULT_CATEGORY_ID,
      name: defaultCategoryName,
      bookmarks: [],
    },
  ];
}

export function normalizeBookmarkLayout(
  value: unknown,
  defaultCategoryName: string,
): BookmarkLayoutCategory[] {
  const fallback = createDefaultBookmarkLayout(defaultCategoryName);
  if (!Array.isArray(value)) return fallback;

  const categories = value.flatMap<BookmarkLayoutCategory>((value) => {
    if (!value || typeof value !== "object") return [];
    const category = value as Partial<BookmarkLayoutCategory>;
    if (
      typeof category.id !== "string" ||
      !category.id ||
      typeof category.name !== "string" ||
      !category.name.trim() ||
      !Array.isArray(category.bookmarks)
    ) {
      return [];
    }

    return [
      {
        id: category.id,
        name: category.name.trim(),
        bookmarks: category.bookmarks.flatMap<BookmarkLayoutNode>((node) => {
          const folder = normalizeLayoutFolder(node);
          if (folder) return [folder];
          const item = normalizeLayoutItem(node);
          return item ? [item] : [];
        }),
      },
    ];
  });

  const uniqueCategories = categories.filter(
    (category, index, all) =>
      all.findIndex((candidate) => candidate.id === category.id) === index,
  );
  return uniqueCategories.some(
    (category) => category.id === DEFAULT_CATEGORY_ID,
  )
    ? uniqueCategories
    : [...fallback, ...uniqueCategories];
}

/**
 * 将布局引用解析成可渲染数据。未出现在布局里的浏览器书签放到 default 根部前方；
 * 已被浏览器删除的 ID 会自然消失，但不会在读取阶段改写用户的持久化布局。
 */
export function resolveBookmarkLayout(
  layout: BookmarkLayoutCategory[],
  browserBookmarks: BrowserBookmark[],
): LauncherBookmarkCategory[] {
  const bookmarkById = new Map(
    browserBookmarks.map((bookmark) => [bookmark.id, bookmark]),
  );
  const managedIds = new Set<string>();

  for (const category of layout) {
    for (const node of category.bookmarks) {
      if (node.type === "item") {
        managedIds.add(node.id);
      } else {
        for (const child of node.children) managedIds.add(child.id);
      }
    }
  }

  const unmanaged = browserBookmarks.flatMap<LauncherBookmarkItem>(
    (bookmark) =>
      managedIds.has(bookmark.id) ? [] : [{ type: "item", ...bookmark }],
  );

  return layout.map((category) => {
    const bookmarks = category.bookmarks.flatMap<LauncherBookmarkNode>(
      (node) => {
        if (node.type === "item") {
          const bookmark = bookmarkById.get(node.id);
          return bookmark ? [{ type: "item", ...bookmark }] : [];
        }

        // 自定义 Folder 不是 Chrome 的目录，只承担 Launcher 内的嵌套和排序。
        const children = node.children.flatMap<LauncherBookmarkItem>(
          (child) => {
            const bookmark = bookmarkById.get(child.id);
            return bookmark ? [{ type: "item", ...bookmark }] : [];
          },
        );
        return [{ ...node, children }];
      },
    );

    return {
      id: category.id,
      name: category.name,
      bookmarks:
        category.id === DEFAULT_CATEGORY_ID
          ? [...unmanaged, ...bookmarks]
          : bookmarks,
    };
  });
}

export function toBookmarkLayout(
  categories: LauncherBookmarkCategory[],
): BookmarkLayoutCategory[] {
  return categories.map(({ id, name, bookmarks }) => ({
    id,
    name,
    bookmarks: bookmarks.map((node) =>
      node.type === "item"
        ? { type: "item", id: node.id }
        : {
            type: "folder",
            id: node.id,
            title: node.title,
            children: node.children.map((child) => ({
              type: "item",
              id: child.id,
            })),
          },
    ),
  }));
}

type BookmarkNodeWithId = BookmarkLayoutNode | LauncherBookmarkNode;

/**
 * 一个 Chrome bookmark 在布局中只能出现一次。放置前先从根节点和自定义 Folder
 * 中清除旧引用，也能消除 onCreated 刷新与界面保存先后不确定造成的重复项。
 */
function removeBookmarkIdFromNodes<T extends BookmarkNodeWithId>(
  nodes: T[],
  bookmarkId: string,
): T[] {
  return nodes.flatMap<T>((node) => {
    if (node.type === "item") return node.id === bookmarkId ? [] : [node];

    if (!node.children.some((item) => item.id === bookmarkId)) return [node];
    const children = node.children.filter((item) => item.id !== bookmarkId);
    return children.length > 0 ? ([{ ...node, children }] as T[]) : [];
  });
}

function placeBookmarkAtCategoryRoot<
  TNode extends BookmarkNodeWithId,
  TCategory extends { id: string; bookmarks: TNode[] },
>(
  categories: TCategory[],
  targetCategoryId: string,
  bookmark: Extract<TNode, { type: "item" }>,
  position: "start" | "end",
): TCategory[] {
  return categories.map((category) => {
    const bookmarks = removeBookmarkIdFromNodes(
      category.bookmarks,
      bookmark.id,
    );
    if (category.id !== targetCategoryId) return { ...category, bookmarks };

    return {
      ...category,
      bookmarks:
        position === "start"
          ? [bookmark, ...bookmarks]
          : [...bookmarks, bookmark],
    };
  });
}

export function placeBookmarkLayoutItemAtRoot(
  categories: BookmarkLayoutCategory[],
  targetCategoryId: string,
  bookmarkId: string,
  position: "start" | "end" = "start",
): BookmarkLayoutCategory[] {
  return placeBookmarkAtCategoryRoot<
    BookmarkLayoutNode,
    BookmarkLayoutCategory
  >(categories, targetCategoryId, { type: "item", id: bookmarkId }, position);
}

export function placeLauncherBookmarkAtRoot(
  categories: LauncherBookmarkCategory[],
  targetCategoryId: string,
  bookmark: LauncherBookmarkItem,
  position: "start" | "end" = "end",
): LauncherBookmarkCategory[] {
  return placeBookmarkAtCategoryRoot<
    LauncherBookmarkNode,
    LauncherBookmarkCategory
  >(categories, targetCategoryId, bookmark, position);
}

/** 把一个根书签合并到另一个根节点，Folder 仅存在于 Launcher 布局中。 */
export function mergeBookmarkIntoNode(
  nodes: LauncherBookmarkNode[],
  sourceId: string,
  targetId: string,
  folderId: string,
  folderTitle = "Folder",
): LauncherBookmarkNode[] {
  if (sourceId === targetId) return nodes;
  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (source?.type !== "item" || !target) return nodes;

  if (target.type === "folder") {
    return nodes.flatMap((node) =>
      node.id === sourceId
        ? []
        : node.id === targetId
          ? [{ ...target, children: [...target.children, source] }]
          : [node],
    );
  }

  const targetIndex = nodes.indexOf(target);
  const sourceWasBeforeTarget = nodes.indexOf(source) < targetIndex;
  const remaining = nodes.filter(
    (node) => node.id !== sourceId && node.id !== targetId,
  );
  const folder: LauncherBookmarkFolder = {
    type: "folder",
    id: folderId,
    title: folderTitle,
    children: [target, source],
  };
  const insertionIndex = targetIndex - (sourceWasBeforeTarget ? 1 : 0);
  return [
    ...remaining.slice(0, insertionIndex),
    folder,
    ...remaining.slice(insertionIndex),
  ];
}

export type BookmarkSortableGroups = Record<string, LauncherBookmarkNode[]>;

export function createBookmarkSortableGroups(
  nodes: LauncherBookmarkNode[],
  rootGroup: string,
): BookmarkSortableGroups {
  const groups: BookmarkSortableGroups = { [rootGroup]: nodes };
  for (const node of nodes) {
    if (node.type === "folder") groups[node.id] = node.children;
  }
  return groups;
}

export function resolveBookmarkSortableGroups(
  groups: BookmarkSortableGroups,
  rootGroup: string,
): LauncherBookmarkNode[] {
  return (groups[rootGroup] ?? []).flatMap<LauncherBookmarkNode>((node) => {
    if (node.type === "item") return [node];
    const children = (groups[node.id] ?? []).filter(
      (child): child is LauncherBookmarkItem => child.type === "item",
    );
    return children.length ? [{ ...node, children }] : [];
  });
}
