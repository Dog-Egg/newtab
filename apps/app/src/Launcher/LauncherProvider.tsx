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
import { platform } from "@platform";
import { useSettings } from "../Settings/SettingsProvider";
import {
  resolveBookmarkLayout,
  toBookmarkLayout,
  type BookmarkLayoutCategory,
  type BrowserBookmark,
  type LauncherBookmarkCategory,
} from "./bookmarkLayout";

type LauncherContextValue = {
  categories: LauncherBookmarkCategory[];
  saveCategories: (categories: LauncherBookmarkCategory[]) => void;
};

const LauncherContext = createContext<LauncherContextValue | null>(null);

export function LauncherProvider({
  children,
  initialLayout,
  initialBookmarks,
}: {
  children: ReactNode;
  initialLayout: BookmarkLayoutCategory[];
  initialBookmarks: BrowserBookmark[];
}) {
  const { settings } = useSettings();
  const [layout, setLayout] = useState(initialLayout);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const loadedLocaleRef = useRef(settings.locale);

  useEffect(() => {
    let isCurrent = true;
    const applyLayout = (storedLayout: BookmarkLayoutCategory[]) => {
      if (isCurrent) setLayout(storedLayout);
    };

    if (loadedLocaleRef.current !== settings.locale) {
      loadedLocaleRef.current = settings.locale;
      void platform.bookmarkLayout
        .read(settings.locale)
        .then(applyLayout, () => undefined);
    }

    const unsubscribeLayout = platform.bookmarkLayout.subscribe(
      settings.locale,
      applyLayout,
    );
    const refreshBookmarks = () => {
      void platform.bookmarks.read().then(
        (nextBookmarks) => {
          if (isCurrent) setBookmarks(nextBookmarks);
        },
        () => undefined,
      );
    };
    const unsubscribeBookmarks = platform.bookmarks.subscribe(refreshBookmarks);

    return () => {
      isCurrent = false;
      unsubscribeLayout();
      unsubscribeBookmarks();
    };
  }, [settings.locale]);

  const categories = useMemo(
    () => resolveBookmarkLayout(layout, bookmarks),
    [bookmarks, layout],
  );

  const saveCategories = useCallback(
    (nextCategories: LauncherBookmarkCategory[]) => {
      const nextLayout = toBookmarkLayout(nextCategories);
      setLayout(nextLayout);
      void platform.bookmarkLayout.save(nextLayout);
    },
    [],
  );

  return (
    <LauncherContext.Provider value={{ categories, saveCategories }}>
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
