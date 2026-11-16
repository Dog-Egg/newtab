import { create } from "zustand";
import { platform } from "@platform";
import {
  flattenBookmarkItems,
  type BrowserBookmarkItem,
  type BrowserBookmarkNode,
} from "../launcher/bookmark-tree";
import { parseBookmarkUsage, rankBookmarks } from "../launcher/bookmark-usage";

type BookmarksStore = {
  isLoaded: boolean;
  bookmarkTree: BrowserBookmarkNode[];
  bookmarks: BrowserBookmarkItem[];
  topBookmarks: BrowserBookmarkItem[];
  recordBookmarkClick: (bookmarkId: string) => void;
};

export const useBookmarksStore = create<BookmarksStore>()(() => ({
  isLoaded: false,
  bookmarkTree: [],
  bookmarks: [],
  topBookmarks: [],
  recordBookmarkClick: (bookmarkId) => {
    // Submit before navigation; keep the dock ranking fixed until reopening.
    void platform.bookmarkUsage.record(bookmarkId).catch((error: unknown) => {
      console.error("Failed to record bookmark click", error);
    });
  },
}));

export function initializeBookmarks() {
  let active = true;
  let refreshVersion = 0;
  let usage = parseBookmarkUsage(undefined);
  const applyTree = (bookmarkTree: BrowserBookmarkNode[]) => {
    const bookmarks = flattenBookmarkItems(bookmarkTree);
    useBookmarksStore.setState({
      bookmarkTree,
      bookmarks,
      topBookmarks: rankBookmarks(bookmarks, usage),
    });
  };
  useBookmarksStore.setState({ isLoaded: false });
  applyTree([]);
  const refreshBookmarks = () => {
    const version = ++refreshVersion;
    void platform.bookmarks
      .read()
      .then((tree) => {
        if (active && version === refreshVersion) applyTree(tree);
      })
      .catch((error: unknown) => {
        console.error("Failed to refresh browser bookmarks", error);
      })
      .finally(() => {
        if (active && version === refreshVersion) {
          useBookmarksStore.setState({ isLoaded: true });
        }
      });
  };
  const unsubscribe = platform.bookmarks.subscribe(refreshBookmarks);
  refreshBookmarks();
  void platform.bookmarkUsage
    .read()
    .then((next) => {
      if (!active) return;
      usage = next;
      const { bookmarks } = useBookmarksStore.getState();
      useBookmarksStore.setState({
        topBookmarks: rankBookmarks(bookmarks, usage),
      });
    })
    .catch((error: unknown) => {
      console.error("Failed to read bookmark usage", error);
    });
  return () => {
    active = false;
    unsubscribe();
  };
}
