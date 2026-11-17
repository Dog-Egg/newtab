import { useLayoutEffect, useRef, useState } from "react";
import { BookmarkLink } from "../components/BookmarkLink";
import { useBookmarksStore } from "../store/bookmarks";

export function BookmarkDock() {
  const topBookmarks = useBookmarksStore((state) => state.topBookmarks);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const [capacity, setCapacity] = useState(1);

  useLayoutEffect(() => {
    const list = listRef.current;
    const item = itemRef.current;
    if (!list || !item) return;

    const observer = new ResizeObserver(() => {
      const width = list.getBoundingClientRect().width;
      const itemWidth = item.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      if (itemWidth <= 0) return;
      setCapacity(
        Math.max(
          1,
          Math.min(10, Math.floor((width + gap) / (itemWidth + gap))),
        ),
      );
    });
    // Observe both available space and the actual item size (including scaling).
    observer.observe(list);
    observer.observe(item);
    return () => observer.disconnect();
  }, [topBookmarks]);

  if (topBookmarks.length === 0) return null;
  return (
    <nav className="shrink-0 px-3 pb-6 pt-3 sm:px-6 sm:pb-8">
      <ul
        ref={listRef}
        className="mx-auto flex max-w-6xl justify-center gap-x-3 sm:gap-x-5"
      >
        {topBookmarks.slice(0, capacity).map((bookmark, index) => (
          <li
            key={bookmark.id}
            ref={index === 0 ? itemRef : undefined}
            className="shrink-0"
          >
            <BookmarkLink bookmark={bookmark} compact />
          </li>
        ))}
      </ul>
    </nav>
  );
}
