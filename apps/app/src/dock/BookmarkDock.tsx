import { BookmarkLink } from "../components/BookmarkLink";
import { useBookmarksStore } from "../store/bookmarks";

export function BookmarkDock() {
  const topBookmarks = useBookmarksStore((state) => state.topBookmarks);
  if (topBookmarks.length === 0) return null;
  return (
    <nav className="shrink-0 px-3 pb-6 pt-3 sm:px-6 sm:pb-8">
      <ul className="mx-auto grid w-fit max-w-6xl grid-cols-3 justify-center gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-5">
        {topBookmarks.map((bookmark) => (
          <li key={bookmark.id} className="shrink-0">
            <BookmarkLink bookmark={bookmark} compact />
          </li>
        ))}
      </ul>
    </nav>
  );
}
