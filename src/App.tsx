import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BOOKMARKS_STORAGE_KEY,
  type BookmarkFolder,
  type BookmarkItem,
  type BookmarkNode,
  normalizeBookmarks,
} from "./bookmarks";

const ICON_GRADIENTS = [
  "linear-gradient(145deg, #2563eb, #0ea5e9)",
  "linear-gradient(145deg, #10b981, #22c55e)",
  "linear-gradient(145deg, #f97316, #ef4444)",
  "linear-gradient(145deg, #8b5cf6, #ec4899)",
  "linear-gradient(145deg, #14b8a6, #06b6d4)",
  "linear-gradient(145deg, #334155, #64748b)",
  "linear-gradient(145deg, #f59e0b, #84cc16)",
  "linear-gradient(145deg, #db2777, #7c3aed)",
];

const MERGE_INTENT_DELAY_MS = 650;
const FOLDER_DROP_ID_PREFIX = "folder-drop:";
const FOLDER_CHILD_DRAG_ID_PREFIX = "folder-child:";

type FolderChildDragData = {
  type: "folder-child";
  folderId: string;
  bookmark: BookmarkItem;
};

type MergeState = "idle" | "ready";
type DropIntent =
  | { type: "none" }
  | { type: "merge" | "sort"; targetId: string };

const DEMO_BOOKMARKS: BookmarkNode[] = [
  {
    type: "bookmark",
    id: "https://trello.com",
    title: "Trello",
    url: "https://trello.com",
    createdAt: 1,
  },
  {
    type: "bookmark",
    id: "https://home.mi.com",
    title: "米家",
    url: "https://home.mi.com",
    createdAt: 2,
  },
  {
    type: "folder",
    id: "folder-finance-demo",
    title: "财务",
    createdAt: 3,
    children: [
      {
        type: "bookmark",
        id: "https://cmbchina.com",
        title: "招商银行",
        url: "https://cmbchina.com",
        createdAt: 3,
      },
    ],
  },
  {
    type: "bookmark",
    id: "https://pan.baidu.com",
    title: "百度网盘",
    url: "https://pan.baidu.com",
    createdAt: 4,
  },
  {
    type: "folder",
    id: "folder-tools-demo",
    title: "实用工具",
    createdAt: 5,
    children: [
      {
        type: "bookmark",
        id: "https://10010.com",
        title: "联通",
        url: "https://10010.com",
        createdAt: 5,
      },
    ],
  },
  {
    type: "folder",
    id: "folder-travel-demo",
    title: "旅行",
    createdAt: 6,
    children: [
      {
        type: "bookmark",
        id: "https://trip.com",
        title: "Trip",
        url: "https://trip.com",
        createdAt: 6,
      },
      {
        type: "bookmark",
        id: "https://ctrip.com",
        title: "携程",
        url: "https://ctrip.com",
        createdAt: 7,
      },
    ],
  },
  {
    type: "bookmark",
    id: "https://1password.com",
    title: "1Password",
    url: "https://1password.com",
    createdAt: 8,
  },
  {
    type: "bookmark",
    id: "https://www.xiachufang.com",
    title: "下厨房",
    url: "https://www.xiachufang.com",
    createdAt: 9,
  },
];

function getSeedIndex(seed: string) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index);
  }

  return total % ICON_GRADIENTS.length;
}

function getHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getIconText(bookmark: BookmarkItem) {
  const source = bookmark.title.trim() || getHostLabel(bookmark.url);
  return source.slice(0, 1).toUpperCase();
}

function getFolderDropId(folderId: string) {
  return `${FOLDER_DROP_ID_PREFIX}${folderId}`;
}

function getFolderChildDragId(folderId: string, bookmarkId: string) {
  return `${FOLDER_CHILD_DRAG_ID_PREFIX}${folderId}:${bookmarkId}`;
}

function isFolderDropId(id: UniqueIdentifier | undefined | null) {
  return typeof id === "string" && id.startsWith(FOLDER_DROP_ID_PREFIX);
}

function isFolderChildDragData(value: unknown): value is FolderChildDragData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<FolderChildDragData>;
  return (
    data.type === "folder-child" &&
    typeof data.folderId === "string" &&
    Boolean(data.bookmark)
  );
}

function canUseChromeStorage() {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

function getBookmarksFromNode(node: BookmarkNode): BookmarkItem[] {
  return node.type === "bookmark" ? [node] : node.children;
}

function dedupeBookmarks(bookmarks: BookmarkItem[]) {
  const seen = new Set<string>();

  return bookmarks.filter((bookmark) => {
    const key = bookmark.url || bookmark.id;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createFolderId() {
  return `folder-${Date.now()}`;
}

function mergeBookmarkNodes(
  bookmarks: BookmarkNode[],
  activeId: string,
  targetId: string,
): BookmarkNode[] {
  const activeNode = bookmarks.find((item) => item.id === activeId);
  const targetNode = bookmarks.find((item) => item.id === targetId);

  if (!activeNode || !targetNode || activeNode.id === targetNode.id) {
    return bookmarks;
  }

  const activeBookmarks = getBookmarksFromNode(activeNode);

  if (targetNode.type === "folder") {
    return bookmarks
      .filter((item) => item.id !== activeId)
      .map((item) =>
        item.id === targetId && item.type === "folder"
          ? {
              ...item,
              children: dedupeBookmarks([
                ...targetNode.children,
                ...activeBookmarks,
              ]),
            }
          : item,
      );
  }

  const folder: BookmarkFolder = {
    type: "folder",
    id: createFolderId(),
    title: "文件夹",
    createdAt: Date.now(),
    children: dedupeBookmarks([targetNode, ...activeBookmarks]),
  };

  return bookmarks.flatMap((item) => {
    if (item.id === activeId) {
      return [];
    }

    if (item.id === targetId) {
      return [folder];
    }

    return [item];
  });
}

function moveBookmarkOutOfFolder(
  bookmarks: BookmarkNode[],
  folderId: string,
  bookmarkId: string,
  targetId?: string | null,
): BookmarkNode[] {
  let movedBookmark: BookmarkItem | null = null;

  const nextBookmarks = bookmarks.flatMap((item): BookmarkNode[] => {
    if (item.type !== "folder" || item.id !== folderId) {
      return [item];
    }

    const bookmark = item.children.find((child) => child.id === bookmarkId);
    if (!bookmark) {
      return [item];
    }

    movedBookmark = bookmark;
    const remainingChildren = item.children.filter(
      (child) => child.id !== bookmarkId,
    );
    if (remainingChildren.length === 0) {
      return [];
    }

    if (remainingChildren.length === 1) {
      return [remainingChildren[0]];
    }

    return [
      {
        ...item,
        children: remainingChildren,
      },
    ];
  });

  if (!movedBookmark) {
    return bookmarks;
  }

  const targetIndex = targetId
    ? nextBookmarks.findIndex((bookmark) => bookmark.id === targetId)
    : -1;
  if (targetIndex < 0) {
    return [...nextBookmarks, movedBookmark];
  }

  return [
    ...nextBookmarks.slice(0, targetIndex),
    movedBookmark,
    ...nextBookmarks.slice(targetIndex),
  ];
}

function getDropIntent(
  activeId: UniqueIdentifier,
  targetId: UniqueIdentifier,
  pointerCoordinates: { x: number; y: number } | null,
  targetRect: { left: number; width: number } | undefined,
  orderedIds: string[],
): DropIntent {
  if (
    !pointerCoordinates ||
    !targetRect ||
    activeId === targetId ||
    isFolderDropId(targetId)
  ) {
    return { type: "none" };
  }

  const activeIndex = orderedIds.indexOf(String(activeId));
  const targetIndex = orderedIds.indexOf(String(targetId));
  if (activeIndex < 0 || targetIndex < 0) {
    return { type: "none" };
  }

  const isTargetLeftHalf =
    pointerCoordinates.x < targetRect.left + targetRect.width / 2;
  const isMovingForward = activeIndex < targetIndex;
  const isMergeHalf = isMovingForward ? isTargetLeftHalf : !isTargetLeftHalf;

  return {
    type: isMergeHalf ? "merge" : "sort",
    targetId: String(targetId),
  };
}

function BookmarkGlyph({
  bookmark,
  size = "normal",
}: {
  bookmark: BookmarkItem;
  size?: "normal" | "small";
}) {
  const isSmall = size === "small";

  return (
    <span
      className={
        isSmall
          ? "grid size-8 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
          : "grid size-24 place-items-center rounded-[26px] text-4xl font-bold text-white shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
      }
      style={{ background: ICON_GRADIENTS[getSeedIndex(bookmark.id)] }}
    >
      {getIconText(bookmark)}
    </span>
  );
}

function FolderGlyph({ folder }: { folder: BookmarkFolder }) {
  const previewBookmarks = folder.children.slice(0, 4);

  return (
    <span className="grid size-24 place-items-start rounded-[26px] bg-white/35 p-3 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),0_18px_35px_rgba(15,23,42,0.16)] ring-1 ring-white/50 backdrop-blur">
      <span className="grid grid-cols-2 gap-2">
        {previewBookmarks.map((bookmark) => (
          <BookmarkGlyph key={bookmark.id} bookmark={bookmark} size="small" />
        ))}
      </span>
    </span>
  );
}

function DesktopItemPreview({
  item,
  mergeState = "idle",
}: {
  item: BookmarkNode;
  mergeState?: MergeState;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-3 text-center">
      <span
        className={[
          "relative grid size-24 place-items-center rounded-[30px] transition duration-150",
          mergeState === "ready"
            ? "scale-110 shadow-[0_0_0_12px_rgba(255,255,255,0.2),0_24px_45px_rgba(15,23,42,0.28)]"
            : "",
        ].join(" ")}
      >
        {item.type === "bookmark" ? (
          <BookmarkGlyph bookmark={item} />
        ) : (
          <FolderGlyph folder={item} />
        )}
      </span>
      <span className="line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]">
        {item.title}
      </span>
    </div>
  );
}

function SortableDesktopItem({
  item,
  mergeState,
  isClickBlocked,
  onOpenFolder,
}: {
  item: BookmarkNode;
  mergeState: MergeState;
  isClickBlocked: () => boolean;
  onOpenFolder: (folderId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (item.type === "folder") {
    return (
      <li
        ref={setNodeRef}
        className={isDragging ? "opacity-30" : ""}
        style={style}
      >
        <button
          className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          type="button"
          onClick={() => {
            if (!isClickBlocked()) {
              onOpenFolder(item.id);
            }
          }}
          {...attributes}
          {...listeners}
        >
          <DesktopItemPreview item={item} mergeState={mergeState} />
        </button>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "opacity-30" : ""}
      style={style}
    >
      <a
        className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
        href={item.url}
        onClick={(event) => {
          if (isClickBlocked()) {
            event.preventDefault();
          }
        }}
        {...attributes}
        {...listeners}
      >
        <DesktopItemPreview item={item} mergeState={mergeState} />
      </a>
    </li>
  );
}

function FolderChildItem({
  folderId,
  bookmark,
  isClickBlocked,
}: {
  folderId: string;
  bookmark: BookmarkItem;
  isClickBlocked: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: getFolderChildDragId(folderId, bookmark.id),
      data: {
        type: "folder-child",
        folderId,
        bookmark,
      } satisfies FolderChildDragData,
    });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "opacity-30" : ""}
      style={style}
    >
      <a
        className="flex touch-none select-none flex-col items-center gap-2 rounded-3xl p-2 text-center outline-none transition hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/70"
        href={bookmark.url}
        onClick={(event) => {
          if (isClickBlocked()) {
            event.preventDefault();
          }
        }}
        {...attributes}
        {...listeners}
      >
        <BookmarkGlyph bookmark={bookmark} />
        <span className="line-clamp-2 min-h-10 w-full text-sm font-semibold leading-5 drop-shadow-sm">
          {bookmark.title}
        </span>
      </a>
    </li>
  );
}

function FolderDialog({
  folder,
  onClose,
  isClickBlocked,
}: {
  folder: BookmarkFolder;
  onClose: () => void;
  isClickBlocked: () => boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: getFolderDropId(folder.id),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <section
        ref={setNodeRef}
        className="w-full max-w-md rounded-[32px] border border-white/45 bg-white/30 p-6 text-white shadow-2xl backdrop-blur-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="truncate text-2xl font-bold drop-shadow-sm">
            {folder.title}
          </h2>
          <button
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/25 text-xl font-semibold outline-none transition hover:bg-white/35 focus-visible:ring-4 focus-visible:ring-white/70"
            type="button"
            onClick={onClose}
            aria-label="关闭文件夹"
          >
            ×
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6">
          {folder.children.map((bookmark) => (
            <FolderChildItem
              key={bookmark.id}
              bookmark={bookmark}
              folderId={folder.id}
              isClickBlocked={isClickBlocked}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

export function App() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeFolderChild, setActiveFolderChild] =
    useState<FolderChildDragData | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const recentlyDraggedRef = useRef(false);
  const mergeTargetRef = useRef<string | null>(null);
  const mergeCandidateRef = useRef<string | null>(null);
  const mergeCandidateStartedAtRef = useRef<number | null>(null);
  const mergeIntentTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const dropIntentRef = useRef<DropIntent>({ type: "none" });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const bookmarkIds = useMemo(
    () => bookmarks.map((bookmark) => bookmark.id),
    [bookmarks],
  );
  const activeItem = activeId
    ? bookmarks.find((bookmark) => bookmark.id === activeId)
    : undefined;
  const activeOverlayItem = activeFolderChild?.bookmark ?? activeItem;
  const openFolder = bookmarks.find(
    (bookmark): bookmark is BookmarkFolder =>
      bookmark.type === "folder" && bookmark.id === openFolderId,
  );

  const saveBookmarks = useCallback((nextBookmarks: BookmarkNode[]) => {
    setBookmarks(nextBookmarks);

    if (canUseChromeStorage()) {
      chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: nextBookmarks });
    }
  }, []);

  const isClickBlocked = useCallback(() => recentlyDraggedRef.current, []);

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length === 0) {
        dropIntentRef.current = { type: "none" };
        return closestCenter(args);
      }

      const firstCollision = pointerCollisions[0];

      if (!firstCollision) {
        dropIntentRef.current = { type: "none" };
        return pointerCollisions;
      }

      const intent = getDropIntent(
        args.active.id,
        firstCollision.id,
        args.pointerCoordinates,
        args.droppableRects.get(firstCollision.id),
        bookmarkIds,
      );

      dropIntentRef.current = intent;
      return intent.type === "merge" ? [] : pointerCollisions;
    },
    [bookmarkIds],
  );

  const clearMergeIntent = useCallback(() => {
    if (mergeIntentTimerRef.current) {
      window.clearTimeout(mergeIntentTimerRef.current);
      mergeIntentTimerRef.current = null;
    }

    mergeCandidateRef.current = null;
    mergeCandidateStartedAtRef.current = null;
    mergeTargetRef.current = null;
    setMergeTargetId(null);
  }, []);

  const updateMergeIntent = useCallback(() => {
    const candidateId =
      dropIntentRef.current.type === "merge"
        ? dropIntentRef.current.targetId
        : null;

    if (!candidateId) {
      clearMergeIntent();
      return;
    }

    if (
      candidateId === mergeCandidateRef.current ||
      candidateId === mergeTargetRef.current
    ) {
      return;
    }

    clearMergeIntent();
    mergeCandidateRef.current = candidateId;
    mergeCandidateStartedAtRef.current = Date.now();
    mergeIntentTimerRef.current = window.setTimeout(() => {
      if (mergeCandidateRef.current === candidateId) {
        mergeTargetRef.current = candidateId;
        setMergeTargetId(candidateId);
      }
    }, MERGE_INTENT_DELAY_MS);
  }, [clearMergeIntent]);

  useEffect(() => {
    if (!canUseChromeStorage()) {
      setBookmarks(DEMO_BOOKMARKS);
      setIsLoading(false);
      return;
    }

    chrome.storage.local.get(BOOKMARKS_STORAGE_KEY, (items) => {
      setBookmarks(normalizeBookmarks(items[BOOKMARKS_STORAGE_KEY]));
      setIsLoading(false);
    });

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[BOOKMARKS_STORAGE_KEY]) {
        return;
      }

      setBookmarks(normalizeBookmarks(changes[BOOKMARKS_STORAGE_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current;

    dropIntentRef.current = { type: "none" };
    setActiveId(event.active.id);
    setActiveFolderChild(isFolderChildDragData(activeData) ? activeData : null);
    clearMergeIntent();
    recentlyDraggedRef.current = false;
  }

  function handleDragMove(event: DragMoveEvent) {
    if (isFolderChildDragData(event.active.data.current)) {
      clearMergeIntent();
      return;
    }

    updateMergeIntent();
  }

  function handleDragOver(event: DragOverEvent) {
    if (isFolderChildDragData(event.active.data.current)) {
      clearMergeIntent();
      return;
    }

    updateMergeIntent();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const finalMergeTargetId =
      dropIntentRef.current.type === "merge"
        ? dropIntentRef.current.targetId
        : null;
    const hasDelayedOverTarget =
      finalMergeTargetId !== null &&
      finalMergeTargetId === mergeCandidateRef.current &&
      mergeCandidateStartedAtRef.current !== null &&
      Date.now() - mergeCandidateStartedAtRef.current >= MERGE_INTENT_DELAY_MS;
    const confirmedMergeTargetId =
      mergeTargetRef.current ??
      (hasDelayedOverTarget ? finalMergeTargetId : null);
    const activeData = active.data.current;

    setActiveId(null);
    setActiveFolderChild(null);
    clearMergeIntent();
    dropIntentRef.current = { type: "none" };
    recentlyDraggedRef.current = true;
    window.setTimeout(() => {
      recentlyDraggedRef.current = false;
    }, 180);

    if (isFolderChildDragData(activeData)) {
      if (isFolderDropId(over?.id)) {
        return;
      }

      const targetId =
        over && !isFolderDropId(over.id) ? String(over.id) : null;
      saveBookmarks(
        moveBookmarkOutOfFolder(
          bookmarks,
          activeData.folderId,
          activeData.bookmark.id,
          targetId,
        ),
      );
      setOpenFolderId(null);
      return;
    }

    if (confirmedMergeTargetId) {
      saveBookmarks(
        mergeBookmarkNodes(
          bookmarks,
          String(active.id),
          confirmedMergeTargetId,
        ),
      );
      return;
    }

    if (!over || active.id === over.id) {
      return;
    }

    const activeIndex = bookmarks.findIndex(
      (bookmark) => bookmark.id === active.id,
    );
    const overIndex = bookmarks.findIndex(
      (bookmark) => bookmark.id === over.id,
    );

    if (activeIndex < 0 || overIndex < 0) {
      return;
    }
    saveBookmarks(arrayMove(bookmarks, activeIndex, overIndex));
  }

  function handleDragCancel() {
    setActiveId(null);
    setActiveFolderChild(null);
    clearMergeIntent();
    dropIntentRef.current = { type: "none" };
  }

  return (
    <DndContext
      collisionDetection={collisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <main className="min-h-screen min-w-80 overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.45),transparent_28%),linear-gradient(135deg,#34b3ae_0%,#41a0b7_48%,#7294d4_100%)] font-sans text-white">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10">
          <header className="flex items-end justify-between gap-4 pb-8">
            <div>
              <h1 className="text-3xl font-bold leading-tight drop-shadow-sm sm:text-4xl">
                Bookmarks
              </h1>
              <p className="mt-2 text-sm font-medium text-white/75">
                {bookmarks.length} 个项目
              </p>
            </div>
          </header>

          {isLoading ? (
            <div className="grid flex-1 place-items-center text-white/80">
              正在加载...
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="grid flex-1 place-items-center">
              <p className="text-lg font-semibold text-white/80">暂无收藏</p>
            </div>
          ) : (
            <SortableContext items={bookmarkIds} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-6 gap-y-9 pb-10 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))] sm:gap-x-8">
                {bookmarks.map((bookmark) => (
                  <SortableDesktopItem
                    key={bookmark.id}
                    item={bookmark}
                    isClickBlocked={isClickBlocked}
                    mergeState={
                      mergeTargetId === bookmark.id ? "ready" : "idle"
                    }
                    onOpenFolder={setOpenFolderId}
                  />
                ))}
              </ul>
            </SortableContext>
          )}
        </section>

        {openFolder ? (
          <FolderDialog
            folder={openFolder}
            isClickBlocked={isClickBlocked}
            onClose={() => setOpenFolderId(null)}
          />
        ) : null}
        <DragOverlay>
          {activeOverlayItem ? (
            <DesktopItemPreview item={activeOverlayItem} />
          ) : null}
        </DragOverlay>
      </main>
    </DndContext>
  );
}
