import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
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
type BookmarkEditTarget = {
  folderId?: string;
  bookmark: BookmarkItem;
};

const DIALOG_ANIMATION_MS = 160;

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

function isFolderChildDragId(id: UniqueIdentifier | undefined | null) {
  return typeof id === "string" && id.startsWith(FOLDER_CHILD_DRAG_ID_PREFIX);
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

function canMergeBookmarkNodes(
  activeNode: BookmarkNode,
  targetNode: BookmarkNode,
): activeNode is BookmarkItem {
  return (
    activeNode.type === "bookmark" &&
    (targetNode.type === "bookmark" || targetNode.type === "folder")
  );
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
  hideTitle = false,
}: {
  item: BookmarkNode;
  mergeState?: MergeState;
  hideTitle?: boolean;
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
      <span
        className={[
          "line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
          hideTitle ? "invisible" : "",
        ].join(" ")}
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

function AppDialog({
  children,
  className = "",
  contentRef,
  onClose,
  onInteractOutside,
}: {
  children: ReactNode;
  className?: string;
  contentRef?: Ref<HTMLDivElement>;
  onClose: () => void;
  onInteractOutside?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }

      closeTimerRef.current = window.setTimeout(onClose, DIALOG_ANIMATION_MS);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={
            "fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-md data-[state=closed]:animate-dialog-overlay-out data-[state=open]:animate-dialog-overlay-in"
          }
        />
        <Dialog.Content
          ref={contentRef}
          className={[
            "fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 border border-white/45 bg-white/30 text-white shadow-2xl outline-none backdrop-blur-xl data-[state=closed]:animate-dialog-content-out data-[state=open]:animate-dialog-content-in",
            className,
          ].join(" ")}
          onInteractOutside={onInteractOutside}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
    <AppDialog className="max-w-sm rounded-[28px] p-5" onClose={onClose}>
      <Dialog.Title className="mb-4 text-lg font-bold drop-shadow-sm">
        编辑书签
      </Dialog.Title>
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
          <Dialog.Close asChild>
            <button
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold outline-none transition hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-white/70"
              type="button"
            >
              取消
            </button>
          </Dialog.Close>
          <button
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!draftTitle.trim() || !draftUrl.trim()}
          >
            保存
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function SortableDesktopItem({
  item,
  mergeState,
  isClickBlocked,
  onOpenFolder,
  onEditBookmark,
  onDeleteBookmark,
}: {
  item: BookmarkNode;
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
      <BookmarkContextMenu
        onEdit={() => onEditBookmark(item)}
        onDelete={() => onDeleteBookmark(item)}
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
    id: getFolderChildDragId(folderId, bookmark.id),
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

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "opacity-30" : ""}
      style={style}
    >
      <BookmarkContextMenu
        onEdit={() => onEditBookmark(folderId, bookmark)}
        onDelete={() => onDeleteBookmark(folderId, bookmark)}
      >
        <a
          className="flex touch-none select-none flex-col items-center gap-2 rounded-3xl p-2 text-center outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
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
          <span
            className={[
              "line-clamp-2 min-h-10 w-full text-sm font-semibold leading-5 drop-shadow-sm",
              isDragging ? "invisible" : "",
            ].join(" ")}
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
  onClose,
  onRenameFolder,
  isClickBlocked,
  onEditBookmark,
  onDeleteBookmark,
}: {
  folder: BookmarkFolder;
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
  const { setNodeRef } = useDroppable({
    id: getFolderDropId(folder.id),
  });

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
    <AppDialog
      className="max-w-md rounded-[32px] p-6"
      contentRef={setNodeRef}
      onClose={handleClose}
      onInteractOutside={() => {
        if (isEditingTitle) {
          commitTitleEdit();
        }
      }}
    >
      <div className="mb-5 flex min-w-0 items-center">
        <Dialog.Title className="sr-only">{folder.title}</Dialog.Title>
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
            className="min-w-0 truncate rounded-xl px-2 py-1 text-left text-2xl font-bold drop-shadow-sm outline-none transition hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/70"
            type="button"
            onClick={startTitleEdit}
            aria-label="编辑文件夹标题"
          >
            {folder.title}
          </button>
        )}
      </div>
      <SortableContext
        items={folder.children.map((bookmark) =>
          getFolderChildDragId(folder.id, bookmark.id),
        )}
        strategy={rectSortingStrategy}
      >
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6">
          {folder.children.map((bookmark) => (
            <FolderChildItem
              key={bookmark.id}
              bookmark={bookmark}
              folderId={folder.id}
              isClickBlocked={isClickBlocked}
              onEditBookmark={onEditBookmark}
              onDeleteBookmark={onDeleteBookmark}
            />
          ))}
        </ul>
      </SortableContext>
    </AppDialog>
  );
}

export function Launcher() {
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeFolderChild, setActiveFolderChild] =
    useState<FolderChildDragData | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [editingBookmark, setEditingBookmark] =
    useState<BookmarkEditTarget | null>(null);
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

      if (isFolderChildDragData(args.active.data.current)) {
        dropIntentRef.current = { type: "none" };
        return [...pointerCollisions].sort(
          (first, second) =>
            Number(!isFolderChildDragId(first.id)) -
            Number(!isFolderChildDragId(second.id)),
        );
      }

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
    [bookmarks],
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
      const overData = over?.data.current;
      if (
        isFolderChildDragData(overData) &&
        overData.folderId === activeData.folderId
      ) {
        if (overData.bookmark.id === activeData.bookmark.id) {
          return;
        }

        saveBookmarks(
          reorderBookmarkInFolder(
            bookmarks,
            activeData.folderId,
            activeData.bookmark.id,
            overData.bookmark.id,
          ),
        );
        return;
      }

      if (isFolderDropId(over?.id)) {
        return;
      }

      const targetId =
        over && !isFolderDropId(over.id) && !isFolderChildDragData(overData)
          ? String(over.id)
          : null;
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
                    onEditBookmark={startTopLevelBookmarkEdit}
                    onDeleteBookmark={deleteTopLevelBookmark}
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
            <DesktopItemPreview
              item={activeOverlayItem}
              hideTitle={activeOverlayItem.type === "bookmark"}
            />
          ) : null}
        </DragOverlay>
      </main>
    </DndContext>
  );
}
