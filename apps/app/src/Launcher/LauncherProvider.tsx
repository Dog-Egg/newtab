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

type LauncherContextValue = {
  bookmarkTree: BrowserBookmarkNode[];
  bookmarks: BrowserBookmarkItem[];
};

const LauncherContext = createContext<LauncherContextValue | null>(null);

export function LauncherProvider({
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
    <LauncherContext.Provider value={{ bookmarkTree, bookmarks }}>
      {children}
    </LauncherContext.Provider>
  );
}

export function useLauncher() {
  const context = useContext(LauncherContext);
  if (!context) {
    throw new Error("useLauncher must be used within LauncherProvider");
  }
  return context;
}
