import { useEffect } from "react";
import { initializeBookmarks, useBookmarksStore } from "./bookmarks";
import { initializeBookmarkNavigation } from "./bookmark-navigation";

export function useBookmarkLifecycle() {
  const isLoaded = useBookmarksStore((state) => state.isLoaded);

  useEffect(() => {
    const disposeBookmarks = initializeBookmarks();
    const disposeNavigation = initializeBookmarkNavigation();
    return () => {
      disposeNavigation();
      disposeBookmarks();
    };
  }, []);

  return isLoaded;
}
