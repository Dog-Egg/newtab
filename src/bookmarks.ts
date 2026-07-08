export type BookmarkItem = {
  type: 'bookmark';
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type BookmarkFolder = {
  type: 'folder';
  id: string;
  title: string;
  createdAt: number;
  children: BookmarkItem[];
};

export type BookmarkNode = BookmarkItem | BookmarkFolder;
export type Bookmark = BookmarkItem;

export const BOOKMARKS_STORAGE_KEY = 'bookmarks';

function normalizeBookmarkItem(value: unknown): BookmarkItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const bookmark = value as Partial<BookmarkItem> & { type?: unknown };
  if (
    typeof bookmark.id !== 'string' ||
    typeof bookmark.title !== 'string' ||
    typeof bookmark.url !== 'string' ||
    typeof bookmark.createdAt !== 'number'
  ) {
    return null;
  }

  return {
    type: 'bookmark',
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
    if (!item || typeof item !== 'object') {
      return [];
    }

    const node = item as Partial<BookmarkFolder> & { type?: unknown };
    if (node.type === 'folder') {
      const children = Array.isArray(node.children)
        ? node.children.flatMap((child) => {
            const bookmark = normalizeBookmarkItem(child);
            return bookmark ? [bookmark] : [];
          })
        : [];

      if (typeof node.id !== 'string' || typeof node.title !== 'string' || typeof node.createdAt !== 'number') {
        return [];
      }

      return [
        {
          type: 'folder',
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
