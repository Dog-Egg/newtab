import { create } from "zustand";
import { platform } from "@platform";
import {
  flattenBookmarkItems,
  type BrowserBookmarkItem,
  type BrowserBookmarkNode,
} from "../launcher/bookmark-tree";
import {
  parseBookmarkUsage,
  rankBookmarks,
  type BookmarkUsage,
} from "../launcher/bookmark-usage";

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

function deriveBookmarkData(
  bookmarkTree: BrowserBookmarkNode[],
  usage: BookmarkUsage,
) {
  const bookmarks = flattenBookmarkItems(bookmarkTree);
  return {
    bookmarkTree,
    bookmarks,
    topBookmarks: rankBookmarks(bookmarks, usage),
  };
}

async function readBookmarks() {
  try {
    return await platform.bookmarks.read();
  } catch (error) {
    console.error("Failed to refresh browser bookmarks", error);
    return undefined;
  }
}

async function readBookmarkUsage() {
  try {
    return await platform.bookmarkUsage.read();
  } catch (error) {
    console.error("Failed to read bookmark usage", error);
    return parseBookmarkUsage(undefined);
  }
}

export function initializeBookmarks() {
  let active = true;
  let refreshVersion = 0;
  let usage = parseBookmarkUsage(undefined);
  useBookmarksStore.setState({
    isLoaded: false,
    ...deriveBookmarkData([], usage),
  });

  const refreshBookmarks = () => {
    const version = ++refreshVersion;
    // Startup will consume changes received before the first snapshot is ready.
    if (!useBookmarksStore.getState().isLoaded) return;
    void readBookmarks().then((tree) => {
      if (active && version === refreshVersion && tree) {
        useBookmarksStore.setState(deriveBookmarkData(tree, usage));
      }
    });
  };
  const unsubscribe = platform.bookmarks.subscribe(refreshBookmarks);

  const loadStartup = async () => {
    const [initialTree, initialUsage] = await Promise.all([
      readBookmarks(),
      readBookmarkUsage(),
    ]);
    let tree = initialTree ?? [];
    let version = 0;
    // Coalesce startup events and catch up before publishing any visible data.
    while (active && version !== refreshVersion) {
      version = refreshVersion;
      tree = (await readBookmarks()) ?? tree;
    }
    if (!active) return;
    usage = initialUsage;
    useBookmarksStore.setState({
      ...deriveBookmarkData(tree, usage),
      isLoaded: true,
    });
  };
  void loadStartup();

  return () => {
    active = false;
    unsubscribe();
  };
}
