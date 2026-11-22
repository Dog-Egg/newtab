import { create } from "zustand";
import {
  findBookmarkFolder,
  getBookmarkRoots,
} from "../../bookmarks/bookmark-tree";
import { findBookmarkRevealDestination } from "./bookmark-navigation";
import { useBookmarksStore } from "../../bookmarks/store";

type NavigationStore = {
  activeRootId: string;
  openFolderId: string | null;
  navigationVersion: number;
  revealedBookmark: { bookmarkId: string; revealKey: number } | null;
  selectRoot: (rootId: string) => void;
  navigateToFolder: (folderId: string | null) => void;
  revealBookmark: (bookmarkId: string) => void;
};

let revealTimer: ReturnType<typeof setTimeout> | undefined;
let revealKey = 0;
function clearRevealTimer() {
  clearTimeout(revealTimer);
  revealTimer = undefined;
}
function getRoots() {
  return getBookmarkRoots(useBookmarksStore.getState().bookmarkTree);
}
function resolveNavigation(activeRootId: string, openFolderId: string | null) {
  const roots = getRoots();
  const root = roots.find((node) => node.id === activeRootId) ?? roots[0];
  return {
    activeRootId: root?.id ?? "",
    openFolderId:
      root && openFolderId && findBookmarkFolder([root], openFolderId)
        ? openFolderId
        : null,
  };
}

export const useBookmarkNavigationStore = create<NavigationStore>()(
  (set, get) => ({
    activeRootId: "",
    openFolderId: null,
    navigationVersion: 0,
    revealedBookmark: null,
    selectRoot: (rootId) => {
      clearRevealTimer();
      set((state) => ({
        ...resolveNavigation(rootId, null),
        revealedBookmark: null,
        navigationVersion: state.navigationVersion + 1,
      }));
    },
    navigateToFolder: (folderId) => {
      clearRevealTimer();
      set((state) => ({
        ...resolveNavigation(state.activeRootId, folderId),
        revealedBookmark: null,
        navigationVersion: state.navigationVersion + 1,
      }));
    },
    revealBookmark: (bookmarkId) => {
      const destination = findBookmarkRevealDestination(getRoots(), bookmarkId);
      if (!destination) return;
      clearRevealTimer();
      const key = ++revealKey;
      set((state) => ({
        activeRootId: destination.rootId,
        openFolderId: destination.folderId,
        revealedBookmark: { bookmarkId, revealKey: key },
        navigationVersion: state.navigationVersion + 1,
      }));
      revealTimer = setTimeout(() => {
        if (get().revealedBookmark?.revealKey === key)
          set({ revealedBookmark: null });
      }, 900);
    },
  }),
);

export function initializeBookmarkNavigation() {
  clearRevealTimer();
  useBookmarkNavigationStore.setState({
    ...resolveNavigation("", null),
    navigationVersion: 0,
    revealedBookmark: null,
  });
  const unsubscribe = useBookmarksStore.subscribe((state, previous) => {
    if (state.bookmarkTree === previous.bookmarkTree) return;
    const { activeRootId, openFolderId } =
      useBookmarkNavigationStore.getState();
    useBookmarkNavigationStore.setState(
      resolveNavigation(activeRootId, openFolderId),
    );
  });
  return () => {
    clearRevealTimer();
    unsubscribe();
  };
}
