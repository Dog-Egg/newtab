import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useHotkeyHint,
  useHotkeys,
  type PhysicalKeyCode,
} from "@tanstack/react-hotkeys";
import { BookmarkLink } from "../components/BookmarkLink";
import { useBookmarksStore } from "../store/bookmarks";

export function BookmarkDock() {
  const topBookmarks = useBookmarksStore((state) => state.topBookmarks);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [editing, setEditing] = useState(false);
  const visibleBookmarks = topBookmarks.slice(0, capacity);

  // Hint visibility follows focus; the library handles keyboard filtering.
  useEffect(() => {
    function updateEditing() {
      const active = document.activeElement;
      setEditing(
        active instanceof HTMLElement &&
          (active.matches("input, textarea, select") ||
            active.isContentEditable),
      );
    }
    updateEditing();
    document.addEventListener("focusin", updateEditing);
    document.addEventListener("focusout", updateEditing);
    return () => {
      document.removeEventListener("focusin", updateEditing);
      document.removeEventListener("focusout", updateEditing);
    };
  }, []);

  useHotkeys(
    visibleBookmarks.map((_, index) => ({
      hotkey: {
        alt: true,
        code: `Digit${(index + 1) % 10}` as PhysicalKeyCode,
      },
      callback: () => {
        const link = listRef.current?.querySelectorAll("a")[index];
        if (link && !link.closest('[inert], [aria-hidden="true"]'))
          link.click();
      },
    })),
    {
      enabled: !editing,
      ignoreInputs: true,
      ignoreDefaultPrevented: true,
      requireReset: true,
    },
  );
  const showShortcuts = useHotkeyHint("Alt+[Digit1]");

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
        {visibleBookmarks.map((bookmark, index) => (
          <li
            key={bookmark.id}
            ref={index === 0 ? itemRef : undefined}
            className="relative shrink-0"
          >
            <BookmarkLink
              bookmark={bookmark}
              compact
              aria-keyshortcuts={`Alt+${(index + 1) % 10}`}
            />
            {showShortcuts && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute -top-1 right-0 flex size-5 items-center justify-center rounded-md bg-white font-sans text-xs font-semibold text-slate-900 shadow-md ring-1 ring-black/10"
              >
                {(index + 1) % 10}
              </kbd>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
