import { useEffect } from "react";
import { initializeBookmarks, useBookmarksStore } from "../../bookmarks/store";
import { initializeBookmarkNavigation } from "./bookmark-navigation-store";

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
