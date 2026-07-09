import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
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
import clsx from "clsx";
import { platform } from "@platform";
import {
  type BookmarkFolder,
  type BookmarkItem,
  type BookmarkNode,
} from "./bookmarks";
import { Dialog, DialogClose, DialogTitle } from "./components/Dialog";
import { SiteIcon } from "./components/SiteIcon";

// 悬停超过该时长后才确认"合并"或"移出文件夹"意图，避免误触
const MERGE_INTENT_DELAY_MS = 650;
const FOLDER_MOVE_OUT_INTENT_DELAY_MS = MERGE_INTENT_DELAY_MS;
const CLICK_DRAG_SUPPRESSION_DISTANCE_PX = 4;
const RECENT_DRAG_CLICK_BLOCK_MS = 300;
const FOLDER_DROP_ID_PREFIX = "folder-drop:";
const FOLDER_CHILD_DRAG_ID_PREFIX = "folder-child:";

// 三种 drag data 通过 type 字段区分，分别表示：桌面顶层项、文件夹内子项、文件夹本身作为放置目标
type TopLevelDragData = {
  type: "top-level";
  node: BookmarkNode;
};

type FolderChildDragData = {
  type: "folder-child";
  folderId: string;
  bookmark: BookmarkItem;
};

type FolderDropData = {
  type: "folder-drop";
  folderId: string;
};

// pending = 悬停计时中（仅视觉提示）；ready = 计时已过，松手即执行
type FolderMoveOutState = {
  status: "pending" | "ready";
  folderId: string;
  bookmarkId: string;
  title: string;
};

// idle = 无目标；pending = 悬停中待确认；ready = 已确认，松手即合并
type MergeState = "idle" | "pending" | "ready";
// 每次 dragMove 计算出的当前意图：不操作 / 合并到目标 / 在目标位置排序
type DropIntent =
  { type: "none" } | { type: "merge" | "sort"; targetId: string };
type BookmarkEditTarget = {
  folderId?: string;
  bookmark: BookmarkItem;
};

function getFolderDropId(folderId: string) {
  return `${FOLDER_DROP_ID_PREFIX}${folderId}`;
}

function getFolderChildDragId(folderId: string, bookmark: BookmarkItem) {
  return `${FOLDER_CHILD_DRAG_ID_PREFIX}${folderId}:${bookmark.id}:${bookmark.createdAt}`;
}

function isFolderDropId(id: UniqueIdentifier | undefined | null) {
  return typeof id === "string" && id.startsWith(FOLDER_DROP_ID_PREFIX);
}

function isTopLevelDragData(value: unknown): value is TopLevelDragData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<TopLevelDragData>;
  return data.type === "top-level" && Boolean(data.node);
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

function isFolderDropData(value: unknown): value is FolderDropData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<FolderDropData>;
  return data.type === "folder-drop" && typeof data.folderId === "string";
}

function isSameFolderCollision(
  collision: {
    data?: { droppableContainer?: { data?: { current?: unknown } } };
  },
  folderId: string,
) {
  const data = collision.data?.droppableContainer?.data?.current;
  return (
    (isFolderChildDragData(data) && data.folderId === folderId) ||
    (isFolderDropData(data) && data.folderId === folderId)
  );
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

// 仅"书签"可作为被合并方；目标可以是书签（凑成新文件夹）或已有文件夹（直接塞入）
function canMergeBookmarkNodes(
  activeNode: BookmarkNode,
  targetNode: BookmarkNode,
): activeNode is BookmarkItem {
  return (
    activeNode.type === "bookmark" &&
    (targetNode.type === "bookmark" || targetNode.type === "folder")
  );
}

// 把 active 合并到 target：目标为文件夹则追加，目标为书签则新建文件夹包裹二者
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

  if (!canMergeBookmarkNodes(activeNode, targetNode)) {
    return bookmarks;
  }

  if (targetNode.type === "folder") {
    return bookmarks
      .filter((item) => item.id !== activeId)
      .map((item) =>
        item.id === targetId && item.type === "folder"
          ? {
              ...item,
              children: dedupeBookmarks([...targetNode.children, activeNode]),
            }
          : item,
      );
  }

  const folder: BookmarkFolder = {
    type: "folder",
    id: createFolderId(),
    title: "文件夹",
    createdAt: Date.now(),
    children: dedupeBookmarks([targetNode, activeNode]),
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

// 把书签从文件夹中"分离"到顶层：移除后若文件夹空则删除，仅剩一个则降级为书签，否则保留文件夹
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

  // targetId 给出落点：未命中则追加到末尾，命中则插到该位置之前
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

function reorderBookmarkInFolder(
  bookmarks: BookmarkNode[],
  folderId: string,
  activeBookmarkId: string,
  overBookmarkId: string,
): BookmarkNode[] {
  if (activeBookmarkId === overBookmarkId) {
    return bookmarks;
  }

  return bookmarks.map((item) => {
    if (item.type !== "folder" || item.id !== folderId) {
      return item;
    }

    const activeIndex = item.children.findIndex(
      (bookmark) => bookmark.id === activeBookmarkId,
    );
    const overIndex = item.children.findIndex(
      (bookmark) => bookmark.id === overBookmarkId,
    );

    if (activeIndex < 0 || overIndex < 0) {
      return item;
    }

    return {
      ...item,
      children: arrayMove(item.children, activeIndex, overIndex),
    };
  });
}

function resolveFolderChildrenAfterDelete(
  folder: BookmarkFolder,
  children: BookmarkItem[],
): BookmarkNode[] {
  if (children.length === 0) {
    return [];
  }

  if (children.length === 1) {
    return [children[0]];
  }

  return [{ ...folder, children }];
}

// 根据指针在目标矩形上的位置判断意图：靠"近 active 一侧的半区"为合并，另一半区为排序插入
function getDropIntent(
  activeId: UniqueIdentifier,
  targetId: UniqueIdentifier,
  pointerCoordinates: { x: number; y: number } | null,
  targetRect: { left: number; width: number } | undefined,
  bookmarks: BookmarkNode[],
): DropIntent {
  if (
    !pointerCoordinates ||
    !targetRect ||
    activeId === targetId ||
    isFolderDropId(targetId)
  ) {
    return { type: "none" };
  }

  const activeIndex = bookmarks.findIndex(
    (bookmark) => bookmark.id === String(activeId),
  );
  const targetIndex = bookmarks.findIndex(
    (bookmark) => bookmark.id === String(targetId),
  );
  if (activeIndex < 0 || targetIndex < 0) {
    return { type: "none" };
  }

  const activeNode = bookmarks[activeIndex];
  const targetNode = bookmarks[targetIndex];
  const isTargetLeftHalf =
    pointerCoordinates.x < targetRect.left + targetRect.width / 2;
  const isMovingForward = activeIndex < targetIndex;
  // 合并半区随拖动方向翻转：向前拖取左半，向后拖取右半，让合并区始终背向 active 的来向
  const isMergeHalf = isMovingForward ? isTargetLeftHalf : !isTargetLeftHalf;

  if (isMergeHalf && !canMergeBookmarkNodes(activeNode, targetNode)) {
    return { type: "none" };
  }

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
    <SiteIcon
      title={bookmark.title}
      url={bookmark.url}
      seed={bookmark.id}
      className={
        isSmall
          ? "size-8 rounded-xl text-xs font-bold shadow-sm"
          : "size-24 rounded-[26px] text-4xl font-bold shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
      }
    />
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
  hideTitle = false,
}: {
  item: BookmarkNode;
  mergeState?: MergeState;
  hideTitle?: boolean;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-3 text-center">
      <span
        className={clsx(
          "relative grid size-24 place-items-center rounded-[30px] transition duration-150",
          mergeState === "ready" &&
            "scale-110 shadow-[0_0_0_12px_rgba(255,255,255,0.2),0_24px_45px_rgba(15,23,42,0.28)]",
        )}
      >
        {item.type === "bookmark" ? (
          <BookmarkGlyph bookmark={item} />
        ) : (
          <FolderGlyph folder={item} />
        )}
      </span>
      <span
        className={clsx(
          "line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
          hideTitle && "invisible",
        )}
      >
        {item.title}
      </span>
    </div>
  );
}

function BookmarkContextMenu({
  children,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-[70] min-w-36 rounded-2xl border border-white/35 bg-white/85 p-1 text-sm font-semibold text-slate-800 shadow-xl outline-none backdrop-blur-md">
          <ContextMenu.Item
            className="cursor-default select-none rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-slate-900 data-[highlighted]:text-white"
            onSelect={onEdit}
          >
            编辑
          </ContextMenu.Item>
          <ContextMenu.Item
            className="cursor-default select-none rounded-xl px-3 py-2 text-red-600 outline-none data-[highlighted]:bg-red-600 data-[highlighted]:text-white"
            onSelect={onDelete}
          >
            删除
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function useDragSafeBookmarkLink(isClickBlocked: () => boolean) {
  const pointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const didPointerMoveRef = useRef(false);
  const clearPointerMoveTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);

  const clearPointerMoveState = useCallback(() => {
    pointerStartRef.current = null;
    didPointerMoveRef.current = false;

    if (clearPointerMoveTimerRef.current) {
      window.clearTimeout(clearPointerMoveTimerRef.current);
      clearPointerMoveTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPointerMoveState, [clearPointerMoveState]);

  const handlePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLAnchorElement>) => {
      if (event.button !== 0) {
        return;
      }

      if (clearPointerMoveTimerRef.current) {
        window.clearTimeout(clearPointerMoveTimerRef.current);
        clearPointerMoveTimerRef.current = null;
      }

      pointerStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      didPointerMoveRef.current = false;
    },
    [],
  );

  const handlePointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLAnchorElement>) => {
      const pointerStart = pointerStartRef.current;
      if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
        return;
      }

      const distance = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      );
      if (distance >= CLICK_DRAG_SUPPRESSION_DISTANCE_PX) {
        didPointerMoveRef.current = true;
      }
    },
    [],
  );

  const handlePointerUpCapture = useCallback(
    (event: ReactPointerEvent<HTMLAnchorElement>) => {
      const pointerStart = pointerStartRef.current;
      if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
        return;
      }

      pointerStartRef.current = null;
      if (didPointerMoveRef.current) {
        if (clearPointerMoveTimerRef.current) {
          window.clearTimeout(clearPointerMoveTimerRef.current);
        }

        // click 在 pointerup 之后合成，延迟清理可覆盖未真正激活 dnd 的轻微拖动。
        clearPointerMoveTimerRef.current = window.setTimeout(() => {
          didPointerMoveRef.current = false;
          clearPointerMoveTimerRef.current = null;
        }, RECENT_DRAG_CLICK_BLOCK_MS);
      }
    },
    [],
  );

  const handlePointerOutCapture = useCallback(
    (event: ReactPointerEvent<HTMLAnchorElement>) => {
      const pointerStart = pointerStartRef.current;
      if (pointerStart?.pointerId === event.pointerId) {
        const nextTarget = event.relatedTarget;
        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return;
        }

        didPointerMoveRef.current = true;
      }
    },
    [],
  );

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (isClickBlocked() || didPointerMoveRef.current) {
        event.preventDefault();
        event.stopPropagation();
      }

      clearPointerMoveState();
    },
    [clearPointerMoveState, isClickBlocked],
  );

  return {
    onClick: handleClick,
    onPointerCancelCapture: clearPointerMoveState,
    onPointerDownCapture: handlePointerDownCapture,
    onPointerMoveCapture: handlePointerMoveCapture,
    onPointerOutCapture: handlePointerOutCapture,
    onPointerUpCapture: handlePointerUpCapture,
  };
}

function BookmarkEditDialog({
  bookmark,
  onClose,
  onSave,
}: {
  bookmark: BookmarkItem;
  onClose: () => void;
  onSave: (title: string, url: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(bookmark.title);
  const [draftUrl, setDraftUrl] = useState(bookmark.url);

  useEffect(() => {
    setDraftTitle(bookmark.title);
    setDraftUrl(bookmark.url);
  }, [bookmark]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    const nextUrl = draftUrl.trim();
    if (!nextTitle || !nextUrl) {
      return;
    }

    onSave(nextTitle, nextUrl);
  }

  return (
    <Dialog className="max-w-sm rounded-[28px] p-5" onClose={onClose}>
      <DialogTitle className="mb-4 text-lg font-bold drop-shadow-sm">
        编辑书签
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <label className="mb-3 block text-sm font-semibold text-white/85">
          标题
          <input
            className="mt-1 w-full rounded-xl bg-white/20 px-3 py-2 text-base text-white outline-none ring-1 ring-white/40 placeholder:text-white/60 focus:ring-2 focus:ring-white/70"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            autoFocus
          />
        </label>
        <label className="block text-sm font-semibold text-white/85">
          URL
          <input
            className="mt-1 w-full rounded-xl bg-white/20 px-3 py-2 text-base text-white outline-none ring-1 ring-white/40 placeholder:text-white/60 focus:ring-2 focus:ring-white/70"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <button
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold outline-none transition hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-white/70"
              type="button"
            >
              取消
            </button>
          </DialogClose>
          <button
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!draftTitle.trim() || !draftUrl.trim()}
          >
            保存
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SortableDesktopItem({
  item,
  sortableId,
  mergeState,
  isClickBlocked,
  onOpenFolder,
  onEditBookmark,
  onDeleteBookmark,
}: {
  item: BookmarkNode;
  sortableId: UniqueIdentifier;
  mergeState: MergeState;
  isClickBlocked: () => boolean;
  onOpenFolder: (folderId: string) => void;
  onEditBookmark: (bookmark: BookmarkItem) => void;
  onDeleteBookmark: (bookmark: BookmarkItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: {
      type: "top-level",
      node: item,
    } satisfies TopLevelDragData,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const bookmarkLinkHandlers = useDragSafeBookmarkLink(isClickBlocked);

  if (item.type === "folder") {
    return (
      <li
        ref={setNodeRef}
        className={clsx("will-change-transform", isDragging && "opacity-30")}
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
      className={clsx("will-change-transform", isDragging && "opacity-30")}
      style={style}
    >
      <BookmarkContextMenu
        onEdit={() => onEditBookmark(item)}
        onDelete={() => onDeleteBookmark(item)}
      >
        <a
          className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          href={item.url}
          {...bookmarkLinkHandlers}
          {...attributes}
          {...listeners}
        >
          <DesktopItemPreview
            item={item}
            mergeState={mergeState}
            hideTitle={isDragging}
          />
        </a>
      </BookmarkContextMenu>
    </li>
  );
}

function FolderChildItem({
  folderId,
  bookmark,
  isClickBlocked,
  onEditBookmark,
  onDeleteBookmark,
}: {
  folderId: string;
  bookmark: BookmarkItem;
  isClickBlocked: () => boolean;
  onEditBookmark: (folderId: string, bookmark: BookmarkItem) => void;
  onDeleteBookmark: (folderId: string, bookmark: BookmarkItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getFolderChildDragId(folderId, bookmark),
    data: {
      type: "folder-child",
      folderId,
      bookmark,
    } satisfies FolderChildDragData,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const bookmarkLinkHandlers = useDragSafeBookmarkLink(isClickBlocked);

  return (
    <li
      ref={setNodeRef}
      className={clsx("will-change-transform", isDragging && "opacity-30")}
      style={style}
    >
      <BookmarkContextMenu
        onEdit={() => onEditBookmark(folderId, bookmark)}
        onDelete={() => onDeleteBookmark(folderId, bookmark)}
      >
        <a
          className="flex touch-none select-none flex-col items-center gap-2 rounded-3xl p-2 text-center outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          href={bookmark.url}
          {...bookmarkLinkHandlers}
          {...attributes}
          {...listeners}
        >
          <BookmarkGlyph bookmark={bookmark} />
          <span
            className={clsx(
              "line-clamp-2 min-h-10 w-full text-sm font-semibold leading-5 drop-shadow-sm",
              isDragging && "invisible",
            )}
          >
            {bookmark.title}
          </span>
        </a>
      </BookmarkContextMenu>
    </li>
  );
}

function FolderDialog({
  folder,
  isClosing = false,
  isMoveOutArmed = false,
  onDialogElementChange,
  onClose,
  onRenameFolder,
  isClickBlocked,
  onEditBookmark,
  onDeleteBookmark,
}: {
  folder: BookmarkFolder;
  isClosing?: boolean;
  isMoveOutArmed?: boolean;
  onDialogElementChange?: (element: HTMLDivElement | null) => void;
  onClose: () => void;
  onRenameFolder: (folderId: string, title: string) => void;
  isClickBlocked: () => boolean;
  onEditBookmark: (folderId: string, bookmark: BookmarkItem) => void;
  onDeleteBookmark: (folderId: string, bookmark: BookmarkItem) => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(folder.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const didFinishTitleEditRef = useRef(false);
  // 整个对话框作为放置区：文件夹子项拖到此处表示"留在文件夹内"，不触发移出
  const { setNodeRef } = useDroppable({
    id: getFolderDropId(folder.id),
    data: {
      type: "folder-drop",
      folderId: folder.id,
    } satisfies FolderDropData,
  });
  const setContentRef = useCallback(
    (element: HTMLDivElement | null) => {
      setNodeRef(element);
      onDialogElementChange?.(element);
    },
    [onDialogElementChange, setNodeRef],
  );

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(folder.title);
    }
  }, [folder.title, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  function startTitleEdit() {
    didFinishTitleEditRef.current = false;
    setDraftTitle(folder.title);
    setIsEditingTitle(true);
  }

  function commitTitleEdit() {
    if (didFinishTitleEditRef.current) {
      return;
    }

    didFinishTitleEditRef.current = true;
    const nextTitle = draftTitle.trim();
    setIsEditingTitle(false);
    if (nextTitle && nextTitle !== folder.title) {
      onRenameFolder(folder.id, nextTitle);
    }
  }

  function cancelTitleEdit() {
    didFinishTitleEditRef.current = true;
    setDraftTitle(folder.title);
    setIsEditingTitle(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitleEdit();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraftTitle(event.target.value);
  }

  function handleClose() {
    if (isEditingTitle) {
      commitTitleEdit();
    }

    onClose();
  }

  return (
    <Dialog
      className={clsx(
        "flex max-h-[calc(100vh-3rem)] max-w-2xl flex-col overflow-hidden rounded-[32px] p-6 transition duration-200 ease-out",
        isMoveOutArmed &&
          "bg-white/24 scale-[0.97] border-white/70 shadow-[0_0_0_8px_rgba(255,255,255,0.08),0_30px_70px_rgba(15,23,42,0.28)]",
      )}
      contentRef={setContentRef}
      isClosing={isClosing}
      onClose={handleClose}
      onInteractOutside={() => {
        if (isEditingTitle) {
          commitTitleEdit();
        }
      }}
    >
      <div className="mb-5 flex min-w-0 shrink-0 items-center">
        <DialogTitle className="sr-only">{folder.title}</DialogTitle>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="min-w-0 flex-1 rounded-xl bg-white/20 px-2 py-1 text-2xl font-bold text-white outline-none ring-2 ring-white/70 placeholder:text-white/60"
            value={draftTitle}
            onBlur={commitTitleEdit}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            aria-label="文件夹标题"
          />
        ) : (
          <button
            className="min-w-0 truncate rounded-xl px-2 py-1 text-left text-2xl font-bold outline-none drop-shadow-sm transition hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/70"
            type="button"
            onClick={startTitleEdit}
            aria-label="编辑文件夹标题"
          >
            {folder.title}
          </button>
        )}
      </div>
      <div className="-mr-2 min-h-0 overflow-y-auto overscroll-contain pr-2">
        <SortableContext
          items={folder.children.map((bookmark) =>
            getFolderChildDragId(folder.id, bookmark),
          )}
          strategy={rectSortingStrategy}
        >
          <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
            {folder.children.map((bookmark) => (
              <FolderChildItem
                key={getFolderChildDragId(folder.id, bookmark)}
                bookmark={bookmark}
                folderId={folder.id}
                isClickBlocked={isClickBlocked}
                onEditBookmark={onEditBookmark}
                onDeleteBookmark={onDeleteBookmark}
              />
            ))}
          </ul>
        </SortableContext>
      </div>
    </Dialog>
  );
}

export function Launcher() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeFolderChild, setActiveFolderChild] =
    useState<FolderChildDragData | null>(null);
  const [mergeCandidateId, setMergeCandidateId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  // 触发关闭动画的文件夹 id；动画结束后才真正卸载对话框
  const [closingFolderId, setClosingFolderId] = useState<string | null>(null);
  // 关闭动画期间继续渲染的文件夹快照，避免 bookmarks 变化导致 Dialog 直接卸载
  const [closingFolderSnapshot, setClosingFolderSnapshot] =
    useState<BookmarkFolder | null>(null);
  // 文件夹子项"拖出"意图的视觉反馈状态（pending 计时中 / ready 已执行）
  const [folderMoveOutState, setFolderMoveOutState] =
    useState<FolderMoveOutState | null>(null);
  const [editingBookmark, setEditingBookmark] =
    useState<BookmarkEditTarget | null>(null);
  // 同步读取最新书签，避免回调闭包捕获旧 state
  const bookmarksRef = useRef<BookmarkNode[]>([]);
  // 拖拽起点快照：cancel 时若已发生"分离"需据此回滚
  const dragStartBookmarksRef = useRef<BookmarkNode[] | null>(null);
  // 拖拽刚结束的短窗口内屏蔽链接点击，防止松手误触发跳转
  const recentDragClickBlockUntilRef = useRef(0);
  const recentDragClickTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  // 合并意图三件套：候选目标 / 候选开始时间 / 已确认目标
  const mergeTargetRef = useRef<string | null>(null);
  const mergeCandidateRef = useRef<string | null>(null);
  const mergeCandidateStartedAtRef = useRef<number | null>(null);
  const mergeIntentTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  // 文件夹移出意图三件套：候选 id / 计时器 / 拟落点目标
  const folderMoveOutCandidateRef = useRef<string | null>(null);
  const folderMoveOutTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const folderMoveOutTargetRef = useRef<string | null>(null);
  // 已被"提起"到顶层的文件夹子项标记，防止同一拖拽内重复触发分离
  const liftedFolderChildRef = useRef<{
    folderId: string;
    bookmarkId: string;
  } | null>(null);
  // 最近一次 collisionDetection 计算出的意图，供 dragEnd 读取
  const dropIntentRef = useRef<DropIntent>({ type: "none" });
  const folderDialogElementRef = useRef<HTMLDivElement | null>(null);
  // 拖拽项是否仍与所属 FolderDialog 相交：以对话框边界判定移出
  const itemInsideFolderDialogRef = useRef<boolean>(true);

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
  function getTopLevelSortableId(bookmark: BookmarkNode) {
    const liftedChild = liftedFolderChildRef.current;
    if (
      liftedChild &&
      bookmark.type === "bookmark" &&
      bookmark.id === liftedChild.bookmarkId
    ) {
      return getFolderChildDragId(liftedChild.folderId, bookmark);
    }

    return bookmark.id;
  }

  const topLevelSortableIds = bookmarks.map(getTopLevelSortableId);
  const activeItem = activeId
    ? bookmarks.find((bookmark) => bookmark.id === activeId)
    : undefined;
  const activeOverlayItem = activeFolderChild?.bookmark ?? activeItem;
  const openFolder = bookmarks.find(
    (bookmark): bookmark is BookmarkFolder =>
      bookmark.type === "folder" && bookmark.id === openFolderId,
  );
  const visibleFolder =
    closingFolderId && closingFolderSnapshot?.id === closingFolderId
      ? closingFolderSnapshot
      : openFolder;

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  useEffect(() => {
    return () => {
      if (mergeIntentTimerRef.current) {
        window.clearTimeout(mergeIntentTimerRef.current);
      }

      if (folderMoveOutTimerRef.current) {
        window.clearTimeout(folderMoveOutTimerRef.current);
      }

      if (recentDragClickTimerRef.current) {
        window.clearTimeout(recentDragClickTimerRef.current);
      }
    };
  }, []);

  const saveBookmarks = useCallback((nextBookmarks: BookmarkNode[]) => {
    bookmarksRef.current = nextBookmarks;
    setBookmarks(nextBookmarks);
    void platform.bookmarks.save(nextBookmarks);
  }, []);

  const renameFolder = useCallback(
    (folderId: string, title: string) => {
      saveBookmarks(
        bookmarks.map((bookmark) =>
          bookmark.type === "folder" && bookmark.id === folderId
            ? { ...bookmark, title }
            : bookmark,
        ),
      );
    },
    [bookmarks, saveBookmarks],
  );

  const editBookmark = useCallback(
    (target: BookmarkEditTarget, title: string, url: string) => {
      saveBookmarks(
        bookmarks.map((bookmark) => {
          if (target.folderId) {
            return bookmark.type === "folder" && bookmark.id === target.folderId
              ? {
                  ...bookmark,
                  children: bookmark.children.map((child) =>
                    child.id === target.bookmark.id
                      ? { ...child, title, url }
                      : child,
                  ),
                }
              : bookmark;
          }

          return bookmark.type === "bookmark" &&
            bookmark.id === target.bookmark.id
            ? { ...bookmark, title, url }
            : bookmark;
        }),
      );
    },
    [bookmarks, saveBookmarks],
  );

  const deleteBookmark = useCallback(
    (target: BookmarkEditTarget) => {
      saveBookmarks(
        bookmarks.flatMap((bookmark): BookmarkNode[] => {
          if (target.folderId) {
            if (bookmark.type !== "folder" || bookmark.id !== target.folderId) {
              return [bookmark];
            }

            return resolveFolderChildrenAfterDelete(
              bookmark,
              bookmark.children.filter(
                (child) => child.id !== target.bookmark.id,
              ),
            );
          }

          if (
            bookmark.type === "bookmark" &&
            bookmark.id === target.bookmark.id
          ) {
            return [];
          }

          return [bookmark];
        }),
      );
    },
    [bookmarks, saveBookmarks],
  );

  function startTopLevelBookmarkEdit(bookmark: BookmarkItem) {
    setEditingBookmark({ bookmark });
  }

  function startFolderBookmarkEdit(folderId: string, bookmark: BookmarkItem) {
    setEditingBookmark({ folderId, bookmark });
  }

  function deleteTopLevelBookmark(bookmark: BookmarkItem) {
    deleteBookmark({ bookmark });
  }

  function deleteFolderBookmark(folderId: string, bookmark: BookmarkItem) {
    deleteBookmark({ folderId, bookmark });
  }

  const clearRecentDragClickBlock = useCallback(() => {
    recentDragClickBlockUntilRef.current = 0;

    if (recentDragClickTimerRef.current) {
      window.clearTimeout(recentDragClickTimerRef.current);
      recentDragClickTimerRef.current = null;
    }
  }, []);

  const blockClicksAfterDrag = useCallback(() => {
    recentDragClickBlockUntilRef.current =
      Date.now() + RECENT_DRAG_CLICK_BLOCK_MS;

    if (recentDragClickTimerRef.current) {
      window.clearTimeout(recentDragClickTimerRef.current);
    }

    recentDragClickTimerRef.current = window.setTimeout(() => {
      if (Date.now() >= recentDragClickBlockUntilRef.current) {
        recentDragClickBlockUntilRef.current = 0;
      }

      recentDragClickTimerRef.current = null;
    }, RECENT_DRAG_CLICK_BLOCK_MS);
  }, []);

  const isClickBlocked = useCallback(
    () => Date.now() < recentDragClickBlockUntilRef.current,
    [],
  );

  const isLiftedFolderChild = useCallback((data: FolderChildDragData) => {
    const liftedChild = liftedFolderChildRef.current;
    return (
      liftedChild?.folderId === data.folderId &&
      liftedChild.bookmarkId === data.bookmark.id
    );
  }, []);
  const setFolderDialogElement = useCallback(
    (element: HTMLDivElement | null) => {
      folderDialogElementRef.current = element;
    },
    [],
  );

  const closeFolderDialogWithAnimation = useCallback((folderId: string) => {
    const folder = bookmarksRef.current.find(
      (bookmark): bookmark is BookmarkFolder =>
        bookmark.type === "folder" && bookmark.id === folderId,
    );

    if (folder) {
      setClosingFolderSnapshot(folder);
    }

    setClosingFolderId(folderId);
  }, []);

  // 把 over 解析为"顶层落点 id"：落在文件夹子项或文件夹放置区上时返回 null（不属于顶层排序目标）
  function getTopLevelOverId(over: DragMoveEvent["over"]) {
    if (!over) {
      return null;
    }

    const data = over.data.current;
    if (isFolderChildDragData(data) || isFolderDropData(data)) {
      return null;
    }

    if (isTopLevelDragData(data)) {
      return data.node.id;
    }

    return !data ? String(over.id) : null;
  }

  // 自定义碰撞检测：分两条路径——文件夹子项拖拽 vs 顶层项拖拽
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const activeData = args.active.data.current;

      // 路径 A：拖动的是文件夹内子项
      if (isFolderChildDragData(activeData)) {
        dropIntentRef.current = { type: "none" };

        // 只要 dragged item 的 rect 仍与 FolderDialog rect 相交，就视作仍在文件夹内；
        // 完全拖出 FolderDialog 边界后才开始判定为需要移出。
        if (
          openFolderId === activeData.folderId &&
          !isLiftedFolderChild(activeData)
        ) {
          const folderDialogRect =
            folderDialogElementRef.current?.getBoundingClientRect();
          const collisionRect = args.collisionRect;
          // rect 不可得时保守视作"在内"，避免误触发移出
          itemInsideFolderDialogRef.current =
            !folderDialogRect || !collisionRect
              ? true
              : collisionRect.right > folderDialogRect.left &&
                collisionRect.left < folderDialogRect.right &&
                collisionRect.bottom > folderDialogRect.top &&
                collisionRect.top < folderDialogRect.bottom;
        }

        // 已被提起为顶层项后，按顶层规则参与碰撞
        if (isLiftedFolderChild(activeData)) {
          return pointerCollisions.length > 0
            ? pointerCollisions
            : closestCenter(args);
        }

        // 指针未落在任何可放置区上：若当前文件夹仍开着则不返回碰撞（避免误移出），否则按最近邻兜底
        if (pointerCollisions.length === 0) {
          return openFolderId === activeData.folderId
            ? []
            : closestCenter(args);
        }

        // 优先返回"同文件夹内"的碰撞，保证子项排序优先于移出
        return [...pointerCollisions].sort(
          (first, second) =>
            Number(!isSameFolderCollision(first, activeData.folderId)) -
            Number(!isSameFolderCollision(second, activeData.folderId)),
        );
      }

      // 路径 B：拖动的是顶层项
      if (pointerCollisions.length === 0) {
        dropIntentRef.current = { type: "none" };
        return closestCenter(args);
      }

      const firstCollision = pointerCollisions[0];

      if (!firstCollision) {
        dropIntentRef.current = { type: "none" };
        return pointerCollisions;
      }

      // 由指针位置判定合并 or 排序；合并时返回空碰撞，阻止 dnd-kit 触发默认排序
      const intent = getDropIntent(
        args.active.id,
        firstCollision.id,
        args.pointerCoordinates,
        args.droppableRects.get(firstCollision.id),
        bookmarks,
      );

      dropIntentRef.current = intent;
      return intent.type === "sort" ? pointerCollisions : [];
    },
    [bookmarks, isLiftedFolderChild, openFolderId],
  );

  const clearMergeIntent = useCallback(() => {
    if (mergeIntentTimerRef.current) {
      window.clearTimeout(mergeIntentTimerRef.current);
      mergeIntentTimerRef.current = null;
    }

    mergeCandidateRef.current = null;
    mergeCandidateStartedAtRef.current = null;
    mergeTargetRef.current = null;
    setMergeCandidateId(null);
    setMergeTargetId(null);
  }, []);

  // 合并意图状态机：候选 → pending（脉冲）→ 计时到期置 ready；候选变更或离开则清空重来
  const updateMergeIntent = useCallback(() => {
    const candidateId =
      dropIntentRef.current.type === "merge"
        ? dropIntentRef.current.targetId
        : null;

    if (!candidateId) {
      clearMergeIntent();
      return;
    }

    // 候选未变或已确认，无需重复触发
    if (
      candidateId === mergeCandidateRef.current ||
      candidateId === mergeTargetRef.current
    ) {
      return;
    }

    clearMergeIntent();
    mergeCandidateRef.current = candidateId;
    mergeCandidateStartedAtRef.current = Date.now();
    setMergeCandidateId(candidateId);
    // 计时到点才"确认"：避免快速划过时误触发合并
    mergeIntentTimerRef.current = window.setTimeout(() => {
      if (mergeCandidateRef.current === candidateId) {
        mergeTargetRef.current = candidateId;
        setMergeCandidateId(null);
        setMergeTargetId(candidateId);
      }
    }, MERGE_INTENT_DELAY_MS);
  }, [clearMergeIntent]);

  const clearFolderMoveOutTimer = useCallback(() => {
    if (folderMoveOutTimerRef.current) {
      window.clearTimeout(folderMoveOutTimerRef.current);
      folderMoveOutTimerRef.current = null;
    }

    folderMoveOutCandidateRef.current = null;
    folderMoveOutTargetRef.current = null;
  }, []);

  const resetFolderMoveOutFeedback = useCallback(() => {
    clearFolderMoveOutTimer();
    setFolderMoveOutState(null);
  }, [clearFolderMoveOutTimer]);

  const clearPendingFolderMoveOutIntent = useCallback(() => {
    clearFolderMoveOutTimer();
    setFolderMoveOutState((currentState) =>
      currentState?.status === "ready" ? currentState : null,
    );
  }, [clearFolderMoveOutTimer]);

  // 真正执行"分离"：把文件夹子项移到顶层，并关闭所属文件夹对话框（动画由 closingFolderId 触发）
  const liftFolderChildToTopLevel = useCallback(
    (activeData: FolderChildDragData) => {
      if (isLiftedFolderChild(activeData)) {
        return;
      }

      const nextBookmarks = moveBookmarkOutOfFolder(
        bookmarksRef.current,
        activeData.folderId,
        activeData.bookmark.id,
        folderMoveOutTargetRef.current,
      );

      closeFolderDialogWithAnimation(activeData.folderId);
      liftedFolderChildRef.current = {
        folderId: activeData.folderId,
        bookmarkId: activeData.bookmark.id,
      };
      saveBookmarks(nextBookmarks);
      setFolderMoveOutState({
        status: "ready",
        folderId: activeData.folderId,
        bookmarkId: activeData.bookmark.id,
        title: activeData.bookmark.title,
      });
    },
    [closeFolderDialogWithAnimation, isLiftedFolderChild, saveBookmarks],
  );

  // 文件夹子项拖拽过程中的"移出意图"检测：拖出对话框且悬停超时即触发分离
  const updateFolderMoveOutIntent = useCallback(
    (event: DragMoveEvent | DragOverEvent) => {
      const activeData = event.active.data.current;
      if (!isFolderChildDragData(activeData)) {
        resetFolderMoveOutFeedback();
        return;
      }

      // 已提起的子项不再重复处理
      if (isLiftedFolderChild(activeData)) {
        return;
      }

      // 仅当所属文件夹正处于打开状态时才考虑移出
      if (openFolderId !== activeData.folderId) {
        return;
      }

      const targetId = getTopLevelOverId(event.over);
      folderMoveOutTargetRef.current = targetId;
      // 拖拽项仍与 FolderDialog 相交则取消移出，出界才开始计时
      if (itemInsideFolderDialogRef.current) {
        clearPendingFolderMoveOutIntent();
        return;
      }

      const candidateId = `${activeData.folderId}:${activeData.bookmark.id}`;
      setFolderMoveOutState({
        status: "pending",
        folderId: activeData.folderId,
        bookmarkId: activeData.bookmark.id,
        title: activeData.bookmark.title,
      });

      // 同一候选已在计时中，不重置
      if (folderMoveOutCandidateRef.current === candidateId) {
        return;
      }

      clearFolderMoveOutTimer();
      folderMoveOutTargetRef.current = targetId;
      folderMoveOutCandidateRef.current = candidateId;
      // 悬停超时才真正提起，避免拖动经过边缘时误触发
      folderMoveOutTimerRef.current = window.setTimeout(() => {
        if (folderMoveOutCandidateRef.current !== candidateId) {
          return;
        }

        folderMoveOutTimerRef.current = null;
        liftFolderChildToTopLevel(activeData);
      }, FOLDER_MOVE_OUT_INTENT_DELAY_MS);
    },
    [
      clearFolderMoveOutTimer,
      clearPendingFolderMoveOutIntent,
      isLiftedFolderChild,
      liftFolderChildToTopLevel,
      openFolderId,
      resetFolderMoveOutFeedback,
    ],
  );

  useEffect(() => {
    let isCurrent = true;

    void platform.bookmarks.read().then(
      (storedBookmarks) => {
        if (!isCurrent) {
          return;
        }

        bookmarksRef.current = storedBookmarks;
        setBookmarks(storedBookmarks);
        setIsLoading(false);
      },
      () => {
        if (isCurrent) {
          setIsLoading(false);
        }
      },
    );

    const unsubscribe = platform.bookmarks.subscribe((storedBookmarks) => {
      bookmarksRef.current = storedBookmarks;
      setBookmarks(storedBookmarks);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function blockNativeLinkClickAfterDrag(event: MouseEvent) {
      if (!isClickBlocked() || !(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!link) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    // React onClick 之外再兜底一次，避免拖拽结束后的合成 click 直接触发 a 标签默认跳转。
    document.addEventListener("click", blockNativeLinkClickAfterDrag, true);
    return () =>
      document.removeEventListener(
        "click",
        blockNativeLinkClickAfterDrag,
        true,
      );
  }, [isClickBlocked]);

  // 拖拽开始：记录起点快照、清空所有进行中的意图，准备进入拖拽态
  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current;

    dropIntentRef.current = { type: "none" };
    // 默认视作"在文件夹内"，等首次 collisionDetection 以拖拽项位置修正，避免拖拽起始瞬间误触发移出
    itemInsideFolderDialogRef.current = true;
    dragStartBookmarksRef.current = bookmarksRef.current;
    liftedFolderChildRef.current = null;
    setClosingFolderId(null);
    setClosingFolderSnapshot(null);
    setActiveId(event.active.id);
    setActiveFolderChild(isFolderChildDragData(activeData) ? activeData : null);
    clearMergeIntent();
    resetFolderMoveOutFeedback();
    clearRecentDragClickBlock();
  }

  // 拖拽移动：按 active 类型分派——文件夹子项走"移出"检测，顶层项走"合并"检测
  function handleDragMove(event: DragMoveEvent) {
    if (isFolderChildDragData(event.active.data.current)) {
      clearMergeIntent();
      updateFolderMoveOutIntent(event);
      return;
    }

    resetFolderMoveOutFeedback();
    updateMergeIntent();
  }

  // dragOver 与 dragMove 处理一致：dnd-kit 在 over 变化时只触发 dragOver，二者都监听更稳
  function handleDragOver(event: DragOverEvent) {
    if (isFolderChildDragData(event.active.data.current)) {
      clearMergeIntent();
      updateFolderMoveOutIntent(event);
      return;
    }

    resetFolderMoveOutFeedback();
    updateMergeIntent();
  }

  // 拖拽结束：根据 active 类型和最终意图分派四种结果——顶层排序 / 合并 / 文件夹内排序 / 移出
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeData = active.data.current;
    const currentBookmarks = bookmarksRef.current;
    const wasLiftedFolderChild =
      isFolderChildDragData(activeData) && isLiftedFolderChild(activeData);
    const finalMergeTargetId =
      dropIntentRef.current.type === "merge"
        ? dropIntentRef.current.targetId
        : null;
    // 兜底：若 timer 回调因事件循环未及时把 candidate 升为 ready，但悬停时长已达标，则视作已确认
    const hasDelayedOverTarget =
      finalMergeTargetId !== null &&
      finalMergeTargetId === mergeCandidateRef.current &&
      mergeCandidateStartedAtRef.current !== null &&
      Date.now() - mergeCandidateStartedAtRef.current >= MERGE_INTENT_DELAY_MS;
    const confirmedMergeTargetId =
      mergeTargetRef.current ??
      (hasDelayedOverTarget ? finalMergeTargetId : null);

    // 统一清理拖拽态
    setActiveId(null);
    setActiveFolderChild(null);
    clearMergeIntent();
    resetFolderMoveOutFeedback();
    dropIntentRef.current = { type: "none" };
    liftedFolderChildRef.current = null;
    dragStartBookmarksRef.current = null;
    // 屏蔽松手后短窗内的点击，防止 a 标签把拖拽释放误当作打开。
    blockClicksAfterDrag();

    // 分支 1：active 是文件夹子项
    if (isFolderChildDragData(activeData)) {
      const overData = over?.data.current;
      // 1a：中途已被提起为顶层项——按顶层规则排序到落点
      if (wasLiftedFolderChild) {
        const targetId = getTopLevelOverId(over);
        if (!targetId || targetId === activeData.bookmark.id) {
          saveBookmarks(currentBookmarks);
          return;
        }

        const activeIndex = currentBookmarks.findIndex(
          (bookmark) => bookmark.id === activeData.bookmark.id,
        );
        const overIndex = currentBookmarks.findIndex(
          (bookmark) => bookmark.id === targetId,
        );

        if (activeIndex < 0 || overIndex < 0) {
          saveBookmarks(currentBookmarks);
          return;
        }

        saveBookmarks(arrayMove(currentBookmarks, activeIndex, overIndex));
        return;
      }

      // 1b：落在同文件夹的兄弟项上——文件夹内重排
      if (
        isFolderChildDragData(overData) &&
        overData.folderId === activeData.folderId
      ) {
        if (overData.bookmark.id === activeData.bookmark.id) {
          return;
        }

        saveBookmarks(
          reorderBookmarkInFolder(
            currentBookmarks,
            activeData.folderId,
            activeData.bookmark.id,
            overData.bookmark.id,
          ),
        );
        return;
      }

      // 1c：拖拽项仍与所属 FolderDialog 相交，保持原样
      if (itemInsideFolderDialogRef.current) {
        return;
      }

      // 1d：拖到了顶层任意位置——执行移出并关闭对话框
      const targetId = getTopLevelOverId(over);
      closeFolderDialogWithAnimation(activeData.folderId);
      saveBookmarks(
        moveBookmarkOutOfFolder(
          currentBookmarks,
          activeData.folderId,
          activeData.bookmark.id,
          targetId,
        ),
      );
      return;
    }

    // 分支 2：active 是顶层项，且已确认合并目标——执行合并
    if (confirmedMergeTargetId) {
      saveBookmarks(
        mergeBookmarkNodes(
          currentBookmarks,
          String(active.id),
          confirmedMergeTargetId,
        ),
      );
      return;
    }

    // 分支 3：顶层项普通排序
    if (!over || active.id === over.id) {
      return;
    }

    const activeIndex = currentBookmarks.findIndex(
      (bookmark) => bookmark.id === active.id,
    );
    const overIndex = currentBookmarks.findIndex(
      (bookmark) => bookmark.id === over.id,
    );

    if (activeIndex < 0 || overIndex < 0) {
      return;
    }
    saveBookmarks(arrayMove(currentBookmarks, activeIndex, overIndex));
  }

  // 取消拖拽（Esc 或外部取消）：若中途已发生"分离"则回滚到起点快照
  function handleDragCancel() {
    if (dragStartBookmarksRef.current && liftedFolderChildRef.current) {
      saveBookmarks(dragStartBookmarksRef.current);
    }

    setActiveId(null);
    setActiveFolderChild(null);
    clearMergeIntent();
    resetFolderMoveOutFeedback();
    setClosingFolderId(null);
    setClosingFolderSnapshot(null);
    liftedFolderChildRef.current = null;
    dragStartBookmarksRef.current = null;
    dropIntentRef.current = { type: "none" };
    blockClicksAfterDrag();
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
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-20 sm:px-10 sm:pb-8">
        {isLoading ? (
          <div className="grid flex-1 place-items-center text-white/80">
            正在加载...
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <p className="text-lg font-semibold text-white/80">暂无收藏</p>
          </div>
        ) : (
          <SortableContext
            items={topLevelSortableIds}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-6 gap-y-9 pb-10 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))] sm:gap-x-8">
              {bookmarks.map((bookmark) => {
                const sortableId = getTopLevelSortableId(bookmark);
                return (
                  <SortableDesktopItem
                    key={sortableId}
                    item={bookmark}
                    sortableId={sortableId}
                    isClickBlocked={isClickBlocked}
                    mergeState={
                      mergeTargetId === bookmark.id
                        ? "ready"
                        : mergeCandidateId === bookmark.id
                          ? "pending"
                          : "idle"
                    }
                    onOpenFolder={setOpenFolderId}
                    onEditBookmark={startTopLevelBookmarkEdit}
                    onDeleteBookmark={deleteTopLevelBookmark}
                  />
                );
              })}
            </ul>
          </SortableContext>
        )}
      </section>

      {visibleFolder ? (
        <FolderDialog
          folder={visibleFolder}
          isClosing={closingFolderId === visibleFolder.id}
          isMoveOutArmed={
            folderMoveOutState?.status === "pending" &&
            folderMoveOutState.folderId === visibleFolder.id
          }
          isClickBlocked={isClickBlocked}
          onDialogElementChange={setFolderDialogElement}
          onClose={() => {
            setOpenFolderId(null);
            setClosingFolderId(null);
            setClosingFolderSnapshot(null);
          }}
          onRenameFolder={renameFolder}
          onEditBookmark={startFolderBookmarkEdit}
          onDeleteBookmark={deleteFolderBookmark}
        />
      ) : null}
      {editingBookmark ? (
        <BookmarkEditDialog
          bookmark={editingBookmark.bookmark}
          onClose={() => setEditingBookmark(null)}
          onSave={(title, url) => {
            editBookmark(editingBookmark, title, url);
            setEditingBookmark(null);
          }}
        />
      ) : null}
      <DragOverlay dropAnimation={null}>
        {activeOverlayItem ? (
          <div className="rotate-1 scale-105 drop-shadow-2xl">
            <DesktopItemPreview
              item={activeOverlayItem}
              hideTitle={activeOverlayItem.type === "bookmark"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
