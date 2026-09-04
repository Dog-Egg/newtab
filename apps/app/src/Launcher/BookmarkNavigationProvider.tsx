import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { findBookmarkFolder, getBookmarkRoots } from "./bookmarkTree";
import { findBookmarkRevealDestination } from "./bookmarkNavigation";
import { useBookmarks } from "./BookmarkProvider";

type RevealedBookmark = {
  bookmarkId: string;
  revealKey: number;
};

type BookmarkNavigationContextValue = {
  activeRootId: string;
  openFolderId: string | null;
  navigationVersion: number;
  revealedBookmark: RevealedBookmark | null;
  selectRoot: (rootId: string) => void;
  navigateToFolder: (folderId: string | null) => void;
  revealBookmark: (bookmarkId: string) => void;
};

const BookmarkNavigationContext =
  createContext<BookmarkNavigationContextValue | null>(null);

export function BookmarkNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { bookmarkTree } = useBookmarks();
  const roots = useMemo(() => getBookmarkRoots(bookmarkTree), [bookmarkTree]);
  const [selectedRootId, setSelectedRootId] = useState(
    () => roots[0]?.id ?? "",
  );
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [revealedBookmark, setRevealedBookmark] =
    useState<RevealedBookmark | null>(null);
  const revealKeyRef = useRef(0);

  const activeRoot =
    roots.find((root) => root.id === selectedRootId) ?? roots[0] ?? null;
  const resolvedActiveRootId = activeRoot?.id ?? "";
  const resolvedOpenFolderId =
    activeRoot && openFolderId && findBookmarkFolder([activeRoot], openFolderId)
      ? openFolderId
      : null;

  useEffect(() => {
    if (!revealedBookmark) return;
    const timeoutId = window.setTimeout(
      () =>
        setRevealedBookmark((currentBookmark) =>
          currentBookmark?.revealKey === revealedBookmark.revealKey
            ? null
            : currentBookmark,
        ),
      900,
    );
    return () => window.clearTimeout(timeoutId);
  }, [revealedBookmark]);

  const selectRoot = useCallback((rootId: string) => {
    setSelectedRootId(rootId);
    setOpenFolderId(null);
    setRevealedBookmark(null);
    setNavigationVersion((version) => version + 1);
  }, []);

  const navigateToFolder = useCallback((folderId: string | null) => {
    setOpenFolderId(folderId);
    setRevealedBookmark(null);
    setNavigationVersion((version) => version + 1);
  }, []);

  const revealBookmark = useCallback(
    (bookmarkId: string) => {
      const destination = findBookmarkRevealDestination(roots, bookmarkId);
      if (!destination) return;

      revealKeyRef.current += 1;
      setSelectedRootId(destination.rootId);
      setOpenFolderId(destination.folderId);
      setRevealedBookmark({
        bookmarkId,
        revealKey: revealKeyRef.current,
      });
      setNavigationVersion((version) => version + 1);
    },
    [roots],
  );

  const value = useMemo(
    () => ({
      activeRootId: resolvedActiveRootId,
      openFolderId: resolvedOpenFolderId,
      navigationVersion,
      revealedBookmark,
      selectRoot,
      navigateToFolder,
      revealBookmark,
    }),
    [
      resolvedActiveRootId,
      resolvedOpenFolderId,
      navigationVersion,
      revealedBookmark,
      selectRoot,
      navigateToFolder,
      revealBookmark,
    ],
  );

  return (
    <BookmarkNavigationContext.Provider value={value}>
      {children}
    </BookmarkNavigationContext.Provider>
  );
}

export function useBookmarkNavigation() {
  const context = useContext(BookmarkNavigationContext);
  if (!context) {
    throw new Error(
      "useBookmarkNavigation must be used within BookmarkNavigationProvider",
    );
  }
  return context;
}
