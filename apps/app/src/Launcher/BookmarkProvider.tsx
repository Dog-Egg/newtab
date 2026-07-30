import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { platform } from "@platform";
import {
  flattenBookmarkItems,
  type BrowserBookmarkItem,
  type BrowserBookmarkNode,
} from "./bookmarkTree";

type BookmarkContextValue = {
  bookmarkTree: BrowserBookmarkNode[];
  bookmarks: BrowserBookmarkItem[];
};

const BookmarkContext = createContext<BookmarkContextValue | null>(null);

export function BookmarkProvider({
  children,
  initialBookmarks,
}: {
  children: ReactNode;
  initialBookmarks: BrowserBookmarkNode[];
}) {
  const [bookmarkTree, setBookmarkTree] = useState(initialBookmarks);

  useEffect(() => {
    let isCurrent = true;
    const refreshBookmarks = () => {
      void platform.bookmarks.read().then(
        (nextTree) => {
          if (isCurrent) setBookmarkTree(nextTree);
        },
        (error: unknown) => {
          console.error("Failed to refresh browser bookmarks", error);
        },
      );
    };
    const unsubscribe = platform.bookmarks.subscribe(refreshBookmarks);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const bookmarks = useMemo(
    () => flattenBookmarkItems(bookmarkTree),
    [bookmarkTree],
  );

  return (
    <BookmarkContext.Provider value={{ bookmarkTree, bookmarks }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error("useBookmarks must be used within BookmarkProvider");
  }
  return context;
}
