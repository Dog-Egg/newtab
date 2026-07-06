export type Bookmark = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export const BOOKMARKS_STORAGE_KEY = 'browserTabBookmarks';

export function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Bookmark => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const bookmark = item as Partial<Bookmark>;
    return (
      typeof bookmark.id === 'string' &&
      typeof bookmark.title === 'string' &&
      typeof bookmark.url === 'string' &&
      typeof bookmark.createdAt === 'number'
    );
  });
}
