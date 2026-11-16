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
} from "./bookmark-tree";
import { parseBookmarkUsage, rankBookmarks } from "./bookmark-usage";

type BookmarkContextValue = {
  bookmarkTree: BrowserBookmarkNode[];
  bookmarks: BrowserBookmarkItem[];
  topBookmarks: BrowserBookmarkItem[];
  recordBookmarkClick: (bookmarkId: string) => void;
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
  const [usage, setUsage] = useState(() => parseBookmarkUsage(undefined));

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

  useEffect(() => {
    let active = true;
    void platform.bookmarkUsage
      .read()
      .then((next) => {
        if (active) setUsage(next);
      })
      .catch((error: unknown) =>
        console.error("Failed to read bookmark usage", error),
      );
    return () => {
      active = false;
    };
  }, []);

  function recordBookmarkClick(bookmarkId: string) {
    // The extension submits to its background worker before the page navigates;
    // web previews write synchronously before returning the promise.
    void platform.bookmarkUsage.record(bookmarkId).catch((error: unknown) => {
      console.error("Failed to record bookmark click", error);
    });
  }

  const topBookmarks = useMemo(
    () => rankBookmarks(bookmarks, usage),
    [bookmarks, usage],
  );

  return (
    <BookmarkContext.Provider
      value={{ bookmarkTree, bookmarks, topBookmarks, recordBookmarkClick }}
    >
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
