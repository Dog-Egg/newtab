import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  DragDropProvider,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { type SortableDraggable } from "@dnd-kit/dom/sortable";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowLeft,
  ChevronRight,
  EllipsisVertical,
  Folder,
  PanelTop,
  Plus,
  Smartphone,
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { platform } from "@platform";
import { Dialog, DialogTitle } from "../components/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/DropdownMenu";
import { SiteIcon } from "../components/SiteIcon";
import { useSettings } from "../Settings/SettingsProvider";
import {
  findBookmarkFolder,
  findBookmarkPath,
  flattenBookmarkItems,
  getBookmarkRoots,
  type BrowserBookmarkFolder,
  type BrowserBookmarkItem,
  type BrowserBookmarkNode,
} from "./bookmarkTree";
import { getBookmarkReorderDestination } from "./bookmarkDrag";
import { DeleteBookmarkCollectionDialog } from "./DeleteBookmarkCollectionDialog";
import { deleteFolderKeepingContents } from "./folderDeletion";
import { useBookmarkNavigation } from "./BookmarkNavigationProvider";
import { useBookmarks } from "./BookmarkProvider";

type EditorState =
  | { mode: "create-item"; parentId: string }
  | { mode: "create-folder"; parentId: string }
  | { mode: "edit"; node: BrowserBookmarkNode };

type SortableCollisionDetector = NonNullable<
  Parameters<typeof useSortable>[0]["collisionDetector"]
>;

const MERGE_TARGET_PREFIX = "merge:";
const BREADCRUMB_TARGET_PREFIX = "breadcrumb:";
const ROOT_TARGET_PREFIX = "root:";
const bookmarkNodeClassName = clsx(
  "flex flex-col items-center gap-2 rounded-2xl text-center",
);
const interactiveBookmarkNodeClassName = clsx(
  bookmarkNodeClassName,
  "outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70",
);

type BookmarkContainer =
  { type: "root"; id: string } | { type: "folder"; id: string };

type BookmarkDndData = Record<string, unknown> & {
  node: BrowserBookmarkNode;
  container: BookmarkContainer;
};

function getBookmarkDndData(
  entity: { data: Record<string, unknown> } | null | undefined,
): BookmarkDndData | null {
  const data = entity?.data as Partial<BookmarkDndData> | undefined;
  return data?.node && data.container ? (data as BookmarkDndData) : null;
}

function getMergeTargetId(bookmarkId: string) {
  return `${MERGE_TARGET_PREFIX}${bookmarkId}`;
}

function getBreadcrumbTargetId(folderId: string) {
  return `${BREADCRUMB_TARGET_PREFIX}${folderId}`;
}

function getRootTargetId(folderId: string) {
  return `${ROOT_TARGET_PREFIX}${folderId}`;
}

/**
 * 保留旧 Launcher 的排序手感：拖拽项的中心越过目标中心后才交换占位，
 * 避免刚刚接触相邻书签时列表就来回跳动。
 */
const reorderCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  const source = dragOperation.source;
  const sourceCurrent = dragOperation.shape?.current;
  const target = droppable.shape;

  if (
    !source ||
    !("sortable" in source) ||
    !sourceCurrent ||
    !target ||
    source.id === droppable.id
  ) {
    return null;
  }

  const placeholder = (
    source as unknown as SortableDraggable<Record<string, unknown>>
  ).sortable.droppable.shape;
  if (!placeholder || sourceCurrent.intersectionArea(target) === 0) return null;

  const targetX = target.center.x - placeholder.center.x;
  const targetY = target.center.y - placeholder.center.y;
  const targetDistanceSquared = targetX ** 2 + targetY ** 2;
  if (targetDistanceSquared === 0) return null;

  const progress =
    ((sourceCurrent.center.x - placeholder.center.x) * targetX +
      (sourceCurrent.center.y - placeholder.center.y) * targetY) /
    targetDistanceSquared;
  if (progress < 1) return null;

  const distance = Math.hypot(
    sourceCurrent.center.x - target.center.x,
    sourceCurrent.center.y - target.center.y,
  );
  return { id: droppable.id, priority: 2, type: 1, value: 1 / (distance + 1) };
};

/** 中心热区只负责“合并”，不会参与外围的排序占位计算。 */
const mergeCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  const source = dragOperation.source;
  const sourceData = getBookmarkDndData(source);
  const targetData = getBookmarkDndData(droppable);
  const target = droppable.shape;
  const pointer = dragOperation.position.current;
  if (
    !sourceData ||
    sourceData.node.id === targetData?.node.id ||
    sourceData.container.id !== targetData?.container.id ||
    sourceData.node.unmodifiable === "managed" ||
    targetData?.node.unmodifiable === "managed" ||
    // Folder 只能放入另一个 Folder；只有两个普通 Bookmark 才能合并成新 Folder。
    (targetData?.node.type !== "folder" &&
      (sourceData.node.type !== "item" || targetData?.node.type !== "item")) ||
    !target
  ) {
    return null;
  }

  const rect = target.boundingRectangle;
  if (
    pointer.x < rect.left ||
    pointer.x > rect.right ||
    pointer.y < rect.top ||
    pointer.y > rect.bottom
  ) {
    return null;
  }

  const distance = Math.hypot(
    pointer.x - target.center.x,
    pointer.y - target.center.y,
  );
  return { id: droppable.id, priority: 4, type: 2, value: 1 / (distance + 1) };
};

/** 面包屑是跨层移动目标：指针进入祖先节点后，优先于网格排序和合并。 */
const breadcrumbCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  const sourceData = getBookmarkDndData(dragOperation.source);
  const targetData = getBookmarkDndData(droppable);
  const target = droppable.shape;
  const pointer = dragOperation.position.current;
  if (
    !sourceData ||
    targetData?.node.type !== "folder" ||
    !target ||
    sourceData.node.id === targetData.node.id
  ) {
    return null;
  }

  const rect = target.boundingRectangle;
  if (
    pointer.x < rect.left ||
    pointer.x > rect.right ||
    pointer.y < rect.top ||
    pointer.y > rect.bottom
  ) {
    return null;
  }

  return { id: droppable.id, priority: 6, type: 2, value: 1 };
};

/**
 * 浏览器根目录是跨根移动目标。只有指针真正进入按钮时才命中；
 * 已经直属于该根目录的节点无需再次移动到目录末尾。
 */
const rootCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  const sourceData = getBookmarkDndData(dragOperation.source);
  const targetData = getBookmarkDndData(droppable);
  const target = droppable.shape;
  const pointer = dragOperation.position.current;
  if (
    !sourceData ||
    targetData?.node.type !== "folder" ||
    !target ||
    sourceData.node.parentId === targetData.node.id
  ) {
    return null;
  }

  const rect = target.boundingRectangle;
  if (
    pointer.x < rect.left ||
    pointer.x > rect.right ||
    pointer.y < rect.top ||
    pointer.y > rect.bottom
  ) {
    return null;
  }

  // 根目录按钮位于独立导航区，命中时应覆盖网格排序与面包屑目标。
  return { id: droppable.id, priority: 8, type: 2, value: 1 };
};

function runBookmarkMutation(promise: Promise<unknown>) {
  void promise.catch(console.error);
}

function getRootIcon(folder: BrowserBookmarkFolder) {
  if (folder.folderType === "bookmarks-bar") return PanelTop;
  if (folder.folderType === "mobile") return Smartphone;
  return Folder;
}

function isModifiableFolder(folder: BrowserBookmarkFolder) {
  return folder.unmodifiable !== "managed" && folder.folderType !== "managed";
}

function BookmarkRootDropTarget({
  root,
  active,
  onSelect,
}: {
  root: BrowserBookmarkFolder;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = getRootIcon(root);
  const data: BookmarkDndData = {
    node: root,
    container: { type: "root", id: root.id },
  };
  const { ref, isDropTarget } = useDroppable<BookmarkDndData>({
    id: getRootTargetId(root.id),
    type: "bookmark-root",
    data,
    disabled: !isModifiableFolder(root),
    collisionDetector: rootCollisionDetector,
  });

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={clsx(
        "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm outline-none backdrop-blur-xl transition duration-200 focus-visible:ring-2 focus-visible:ring-glass-focus",
        // 命中状态使用深色半透明底，拖拽预览覆盖在附近时文字仍有足够对比度。
        // ring 只负责强调目标，不会像 border 一样改变按钮和相邻元素的位置。
        isDropTarget
          ? "scale-105 bg-slate-950/75 text-white shadow-lg ring-2 ring-white/45"
          : active
            ? "bg-white text-slate-900 hover:bg-white/90"
            : "bg-slate-900/35 text-white/70 hover:bg-slate-900/50 hover:text-white",
      )}
      onClick={onSelect}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      {root.title}
    </button>
  );
}

function MergeTargetFrame({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  return (
    <span
      className="relative shrink-0"
      style={{ width: 64 * nodeScale, height: 64 * nodeScale }}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/30 shadow-[0_18px_35px_rgba(15,23,42,0.22)] transition-all duration-200 ease-out"
        style={{
          width: (active ? 72 : 64) * nodeScale,
          height: (active ? 72 : 64) * nodeScale,
          borderRadius: (active ? 22 : 18) * nodeScale,
        }}
      />
      <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        {children}
      </span>
    </span>
  );
}

function FolderPreview({
  folder,
  isMergeTarget = false,
}: {
  folder: BrowserBookmarkFolder;
  isMergeTarget?: boolean;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  const previewItems = flattenBookmarkItems(folder.children).slice(0, 4);

  return (
    <MergeTargetFrame active={isMergeTarget}>
      <span
        className="grid grid-cols-2 grid-rows-2"
        style={{
          width: 64 * nodeScale,
          height: 64 * nodeScale,
          borderRadius: 18 * nodeScale,
          padding: 8 * nodeScale,
          gap: 4 * nodeScale,
        }}
      >
        {previewItems.length > 0 ? (
          previewItems.map((item) => (
            <SiteIcon
              key={item.id}
              title={item.title}
              url={item.url}
              seed={item.id}
              className="size-full min-h-0 min-w-0 font-bold shadow-sm"
              style={{
                borderRadius: 7 * nodeScale,
                fontSize: 10 * nodeScale,
              }}
            />
          ))
        ) : (
          <Folder
            className="col-span-2 row-span-2 m-auto text-white/80"
            style={{ width: 28 * nodeScale, height: 28 * nodeScale }}
            aria-hidden="true"
          />
        )}
      </span>
    </MergeTargetFrame>
  );
}

function BookmarkPreview({
  bookmark,
  isMergeTarget = false,
}: {
  bookmark: BrowserBookmarkItem;
  isMergeTarget?: boolean;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  return (
    <MergeTargetFrame active={isMergeTarget}>
      <SiteIcon
        title={bookmark.title}
        url={bookmark.url}
        seed={bookmark.id}
        className="font-bold shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
        style={{
          width: 64 * nodeScale,
          height: 64 * nodeScale,
          borderRadius: 18 * nodeScale,
          fontSize: 24 * nodeScale,
        }}
      />
    </MergeTargetFrame>
  );
}

function BookmarkNodeCard({
  node,
  index,
  group,
  container,
  isRenaming,
  isLocated,
  onOpen,
  onEdit,
  onRename,
  onCancelRename,
  onDelete,
}: {
  node: BrowserBookmarkNode;
  index: number;
  group: string;
  container: BookmarkContainer;
  isRenaming: boolean;
  isLocated: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const {
    settings: { nodeScale },
  } = useSettings();
  const isModifiable = node.unmodifiable !== "managed";
  const [draftTitle, setDraftTitle] = useState(node.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const locatedCardRef = useRef<HTMLDivElement>(null);
  const data: BookmarkDndData = { node, container };
  const { ref, handleRef, isDragging } = useSortable<BookmarkDndData>({
    id: node.id,
    index,
    group,
    type: node.type,
    data,
    disabled: !isModifiable || isRenaming,
    collisionDetector: reorderCollisionDetector,
  });
  const { ref: mergeRef, isDropTarget: isMergeTarget } =
    useDroppable<BookmarkDndData>({
      id: getMergeTargetId(node.id),
      type: "merge",
      data,
      disabled: !isModifiable || isRenaming,
      collisionDetector: mergeCollisionDetector,
    });

  useEffect(() => {
    setDraftTitle(node.title);
    if (!isRenaming) return;
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [isRenaming, node.title]);

  useEffect(() => {
    if (!isLocated) return;
    locatedCardRef.current?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [isLocated]);

  function commitRename() {
    const title = draftTitle.trim();
    if (!title || title === node.title) {
      onCancelRename();
      return;
    }
    onRename(title);
  }

  const content =
    node.type === "item" ? (
      <a
        ref={handleRef as Ref<HTMLAnchorElement>}
        className={interactiveBookmarkNodeClassName}
        style={{ width: 80 * nodeScale }}
        href={node.url}
        target="_parent"
        rel="noreferrer"
      >
        <BookmarkPreview bookmark={node} isMergeTarget={isMergeTarget} />
        <NodeLabel node={node} hidden={isDragging} />
      </a>
    ) : isRenaming ? (
      <div className={bookmarkNodeClassName} style={{ width: 80 * nodeScale }}>
        <FolderPreview folder={node} />
        <span
          className="flex w-full items-start justify-center"
          style={{ minHeight: 40 * nodeScale }}
        >
          <input
            ref={renameInputRef}
            className="w-full rounded-lg bg-white/20 px-1.5 py-1 text-center font-semibold text-white shadow-sm outline-none ring-2 ring-white/70 backdrop-blur-md"
            style={{
              fontSize: 14 * nodeScale,
              lineHeight: `${20 * nodeScale}px`,
            }}
            value={draftTitle}
            aria-label={t("launcher.renameFolder")}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitRename}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraftTitle(node.title);
                onCancelRename();
              }
            }}
          />
        </span>
      </div>
    ) : (
      <button
        ref={handleRef as Ref<HTMLButtonElement>}
        type="button"
        className={interactiveBookmarkNodeClassName}
        style={{ width: 80 * nodeScale }}
        onClick={onOpen}
      >
        <FolderPreview folder={node} isMergeTarget={isMergeTarget} />
        <NodeLabel node={node} hidden={isDragging} />
      </button>
    );

  return (
    <li
      ref={ref}
      className={clsx(
        "group relative flex touch-none select-none justify-center rounded-[30px] transition will-change-transform",
        isDragging && "opacity-30",
      )}
    >
      <span
        ref={mergeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      {isModifiable ? (
        <div
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
          style={{ width: 64 * nodeScale, height: 64 * nodeScale }}
        >
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={t("search.moreActionsFor", { name: node.title })}
                title={t("search.moreActions")}
                className="pointer-events-auto invisible absolute right-0 top-0 grid size-6 -translate-y-1/3 translate-x-1/3 place-items-center rounded-full bg-slate-900/60 text-glass-content opacity-0 shadow-[0_8px_24px_rgba(15,23,42,0.24)] outline-none backdrop-blur-2xl transition-[color,background-color,opacity,visibility] delay-0 duration-200 hover:bg-slate-900/70 hover:text-glass-strong focus-visible:visible focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-glass-focus focus-visible:delay-0 group-hover:visible group-hover:opacity-100 group-hover:delay-500 data-[state=open]:visible data-[state=open]:bg-slate-900/70 data-[state=open]:text-glass-strong data-[state=open]:opacity-100 data-[state=open]:delay-0 motion-reduce:transition-none motion-reduce:delay-0"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <EllipsisVertical className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onEdit}>
                  {t(
                    node.type === "folder" ? "launcher.rename" : "common.edit",
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={onDelete}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      ) : null}
      <div
        ref={locatedCardRef}
        className={clsx(isLocated && "bookmark-locate-shake")}
      >
        {content}
      </div>
    </li>
  );
}

function NodeLabel({
  node,
  hidden = false,
}: {
  node: BrowserBookmarkNode;
  hidden?: boolean;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  return (
    <span
      className={clsx(
        "flex w-full flex-col items-center",
        hidden && "invisible",
      )}
    >
      <span
        className="line-clamp-2 w-full text-balance font-semibold text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]"
        style={{
          minHeight: 40 * nodeScale,
          fontSize: 12 * nodeScale,
          lineHeight: `${20 * nodeScale}px`,
        }}
      >
        {node.title}
      </span>
    </span>
  );
}

function DraggedNodePreview({ node }: { node: BrowserBookmarkNode }) {
  const {
    settings: { nodeScale },
  } = useSettings();
  return (
    <div
      className="flex rotate-1 scale-105 flex-col items-center gap-2 drop-shadow-2xl"
      style={{ width: 80 * nodeScale }}
    >
      {node.type === "item" ? (
        <BookmarkPreview bookmark={node} />
      ) : (
        <FolderPreview folder={node} />
      )}
      <NodeLabel node={node} hidden />
    </div>
  );
}

function BookmarkEditorDialog({
  state,
  onClose,
}: {
  state: EditorState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isFolder =
    state.mode === "create-folder" ||
    (state.mode === "edit" && state.node.type === "folder");
  const initialTitle = state.mode === "edit" ? state.node.title : "";
  const initialUrl =
    state.mode === "edit" && state.node.type === "item" ? state.node.url : "";
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedUrl = url.trim();
    if (!normalizedTitle || (!isFolder && !normalizedUrl)) return;

    if (state.mode === "edit") {
      runBookmarkMutation(
        platform.bookmarks.update(
          state.node.id,
          state.node.type === "folder"
            ? { title: normalizedTitle }
            : { title: normalizedTitle, url: normalizedUrl },
        ),
      );
    } else {
      runBookmarkMutation(
        platform.bookmarks.create({
          parentId: state.parentId,
          title: normalizedTitle,
          ...(isFolder ? {} : { url: normalizedUrl }),
        }),
      );
    }
    onClose();
  }

  return (
    <Dialog className="max-w-md p-7" onClose={onClose}>
      {(close) => (
        <form className="space-y-5" onSubmit={submit}>
          <DialogTitle className="text-xl font-bold text-white">
            {state.mode === "edit"
              ? isFolder
                ? t("launcher.renameFolder")
                : t("launcher.editBookmark")
              : isFolder
                ? t("launcher.newFolder")
                : t("launcher.addBookmark")}
          </DialogTitle>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/80">
              {t("launcher.name")}
            </span>
            <input
              ref={titleRef}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/15 px-4 text-white outline-none placeholder:text-white/45 focus:border-white/60"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          {!isFolder ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-white/80">
                {t("launcher.url")}
              </span>
              <input
                className="h-11 w-full rounded-xl border border-white/20 bg-white/15 px-4 text-white outline-none placeholder:text-white/45 focus:border-white/60"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
            </label>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"
              onClick={close}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-white/90"
            >
              {t("launcher.done")}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function DeleteBookmarkDialog({
  node,
  onClose,
  onConfirm,
}: {
  node: BrowserBookmarkNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog className="max-w-md p-7" onClose={onClose}>
      {(close) => (
        <div className="space-y-5">
          <DialogTitle className="text-xl font-bold text-white">
            {t(
              node.type === "folder"
                ? "launcher.deleteFolder"
                : "launcher.deleteBookmark",
            )}
          </DialogTitle>
          <p className="leading-7 text-white/75">
            {t(
              node.type === "folder"
                ? "launcher.deleteFolderConfirm"
                : "launcher.deleteBookmarkConfirm",
              { name: node.title },
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"
              onClick={close}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-500/90 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
              onClick={onConfirm}
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function AddBookmarkButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const {
    settings: { nodeScale },
  } = useSettings();

  return (
    <button
      type="button"
      aria-label={t("launcher.addBookmark")}
      onClick={onClick}
      className="group flex w-full flex-col items-center rounded-[30px] text-center text-white outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
      style={{ width: 88 * nodeScale, gap: 8 * nodeScale }}
    >
      <span
        className="grid place-items-center border border-dashed border-white/55 bg-white/10 text-white/85 shadow-[0_18px_35px_rgba(15,23,42,0.16)] backdrop-blur-md transition duration-200 group-hover:border-white/80 group-hover:bg-white/20 group-hover:text-white"
        style={{
          width: 64 * nodeScale,
          height: 64 * nodeScale,
          borderRadius: 18 * nodeScale,
        }}
      >
        <Plus
          strokeWidth={1.75}
          style={{ width: 30 * nodeScale, height: 30 * nodeScale }}
        />
      </span>
    </button>
  );
}

function BookmarkBreadcrumb({
  path,
  editTitleInitially,
  onNavigate,
  onRename,
}: {
  path: BrowserBookmarkFolder[];
  editTitleInitially: boolean;
  onNavigate: (folder: BrowserBookmarkFolder) => void;
  onRename: (title: string) => void;
}) {
  const { t } = useTranslation();
  const folder = path[path.length - 1];
  const [isEditingTitle, setIsEditingTitle] = useState(editTitleInitially);
  const [title, setTitle] = useState(folder?.title ?? "");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!folder) return;
    setTitle(folder.title);
    setIsEditingTitle(editTitleInitially);
    if (editTitleInitially) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [editTitleInitially, folder.id, folder.title]);

  if (!folder) return null;

  function commitTitle() {
    const nextTitle = title.trim();
    setIsEditingTitle(false);
    if (!nextTitle) {
      setTitle(folder.title);
      return;
    }
    setTitle(nextTitle);
    if (nextTitle !== folder.title) onRename(nextTitle);
  }

  const RootIcon = getRootIcon(path[0]);

  return (
    <nav
      className="flex min-h-10 items-center gap-2 border-b border-white/15 text-sm text-white"
      aria-label={t("launcher.breadcrumbs")}
    >
      {/* 两端为外扩焦点环留出空间；负边距抵消 padding，面包屑内容本身不会位移。 */}
      <ol className="-mx-1 flex min-w-0 items-center overflow-x-auto p-1 [scrollbar-width:none]">
        {path.map((item, index) => {
          const isCurrent = index === path.length - 1;
          return (
            <li key={item.id} className="flex min-w-0 items-center">
              {index > 0 ? (
                <ChevronRight
                  className="mx-0.5 size-4 shrink-0 text-white/45"
                  aria-hidden="true"
                />
              ) : null}
              {index === 0 && isCurrent ? (
                // 第一个面包屑沿用根目录 nav 的“图标 + 标题”结构。
                <span
                  className="flex max-w-56 items-center gap-2 px-2 py-1.5 font-semibold"
                  aria-current="page"
                >
                  <RootIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.title}</span>
                </span>
              ) : isCurrent ? (
                isEditingTitle && path.length > 1 ? (
                  <input
                    ref={titleInputRef}
                    className="min-w-24 max-w-56 rounded-xl bg-white/15 px-3 py-1.5 font-bold outline-none ring-2 ring-white/60 [font:inherit]"
                    value={title}
                    aria-label={t("launcher.renameFolder")}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        setTitle(folder.title);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                ) : path.length > 1 && isModifiableFolder(item) ? (
                  <button
                    type="button"
                    className="max-w-56 truncate rounded-lg px-2 py-1.5 text-left font-bold outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
                    aria-current="page"
                    onClick={() => {
                      setIsEditingTitle(true);
                      requestAnimationFrame(() => {
                        titleInputRef.current?.focus();
                        titleInputRef.current?.select();
                      });
                    }}
                  >
                    {item.title}
                  </button>
                ) : (
                  <span
                    className="max-w-56 truncate px-2 py-1.5 font-bold"
                    aria-current="page"
                  >
                    {item.title}
                  </span>
                )
              ) : (
                <BreadcrumbDropTarget
                  folder={item}
                  isRoot={index === 0}
                  showBackIcon={index === 0 && path.length > 1}
                  onNavigate={() => onNavigate(item)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbDropTarget({
  folder,
  isRoot,
  showBackIcon,
  onNavigate,
}: {
  folder: BrowserBookmarkFolder;
  isRoot: boolean;
  showBackIcon: boolean;
  onNavigate: () => void;
}) {
  const data: BookmarkDndData = {
    node: folder,
    container: { type: isRoot ? "root" : "folder", id: folder.id },
  };
  const { ref, isDropTarget } = useDroppable<BookmarkDndData>({
    id: getBreadcrumbTargetId(folder.id),
    type: "breadcrumb",
    data,
    disabled: !isModifiableFolder(folder),
    collisionDetector: breadcrumbCollisionDetector,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={clsx(
        "flex max-w-44 shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 text-white/70 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60",
        isDropTarget &&
          "bg-white/25 font-semibold text-white ring-2 ring-white/70",
      )}
      onClick={onNavigate}
    >
      {showBackIcon ? (
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="truncate">{folder.title}</span>
    </button>
  );
}

export function Launcher() {
  const { t } = useTranslation();
  const { bookmarkTree } = useBookmarks();
  const {
    activeRootId,
    openFolderId,
    revealedBookmark,
    selectRoot,
    navigateToFolder,
  } = useBookmarkNavigation();
  const {
    settings: { nodeScale },
  } = useSettings();
  const roots = useMemo(() => getBookmarkRoots(bookmarkTree), [bookmarkTree]);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<BrowserBookmarkNode | null>(null);
  const [activeNode, setActiveNode] = useState<BrowserBookmarkNode | null>(
    null,
  );

  const activeRoot =
    roots.find((root) => root.id === activeRootId) ?? roots[0] ?? null;
  const openFolder =
    activeRoot && openFolderId
      ? findBookmarkFolder([activeRoot], openFolderId)
      : null;
  const openFolderPath =
    activeRoot && openFolder
      ? (findBookmarkPath([activeRoot], openFolder.id) ?? [activeRoot])
      : [];
  const currentFolder = openFolder ?? activeRoot;
  const currentPath = (
    openFolderPath.length > 0 ? openFolderPath : activeRoot ? [activeRoot] : []
  ).filter((node): node is BrowserBookmarkFolder => node.type === "folder");

  useEffect(() => setRenameFolderId(null), [activeRootId, openFolderId]);

  if (!activeRoot || !currentFolder) return null;

  function canMoveInside(draggedNodeId: string, target: BrowserBookmarkFolder) {
    if (draggedNodeId === target.id || !isModifiableFolder(target)) {
      return false;
    }
    const draggedPath = findBookmarkPath(bookmarkTree, draggedNodeId);
    const dragged = draggedPath?.[draggedPath.length - 1];
    return !(
      dragged?.type === "folder" &&
      findBookmarkPath([dragged], target.id) !== null
    );
  }

  async function mergeBookmarksIntoNewFolder(
    source: BrowserBookmarkItem,
    target: BrowserBookmarkItem,
    parentId: string,
  ) {
    // 浏览器书签是唯一数据源：先在目标位置创建真实文件夹，再按顺序迁入两项。
    const folder = await platform.bookmarks.create({
      parentId,
      title: t("launcher.folder"),
      index: target.index,
    });
    if (folder.type !== "folder") {
      throw new Error("Browser created a bookmark instead of a folder");
    }
    await platform.bookmarks.move(target.id, { parentId: folder.id, index: 0 });
    await platform.bookmarks.move(source.id, { parentId: folder.id, index: 1 });
  }

  function handleDragStart(event: DragStartEvent) {
    const sourceData = getBookmarkDndData(event.operation.source);
    if (sourceData) setActiveNode(sourceData.node);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveNode(null);
    if (event.canceled) return;

    const source = event.operation.source;
    const sourceData = getBookmarkDndData(source);
    const target = event.operation.target;
    const targetData = getBookmarkDndData(target);
    if (!sourceData) return;

    if (
      target?.type === "bookmark-root" &&
      targetData?.node.type === "folder"
    ) {
      if (
        sourceData.node.parentId === targetData.node.id ||
        !isModifiableFolder(targetData.node)
      ) {
        return;
      }
      // 跨根目录移动时放到目标根的末尾，现有书签顺序不会被打乱。
      runBookmarkMutation(
        platform.bookmarks.move(sourceData.node.id, {
          parentId: targetData.node.id,
          index: targetData.node.children.length,
        }),
      );
      return;
    }

    if (target?.type === "breadcrumb" && targetData?.node.type === "folder") {
      if (!canMoveInside(sourceData.node.id, targetData.node)) return;
      // 页面化后不再依赖“拖出弹窗”：把节点放到任意祖先面包屑，
      // 即可一次完成跨层移动，并保留该祖先中已有内容的顺序。
      runBookmarkMutation(
        platform.bookmarks.move(sourceData.node.id, {
          parentId: targetData.node.id,
          index: targetData.node.children.length,
        }),
      );
      return;
    }

    if (target?.type === "merge" && targetData) {
      if (targetData.node.type === "folder") {
        if (!canMoveInside(sourceData.node.id, targetData.node)) return;
        runBookmarkMutation(
          platform.bookmarks.move(sourceData.node.id, {
            parentId: targetData.node.id,
            index: targetData.node.children.length,
          }),
        );
      } else if (sourceData.node.type === "item") {
        runBookmarkMutation(
          mergeBookmarksIntoNewFolder(
            sourceData.node,
            targetData.node,
            targetData.container.id,
          ),
        );
      }
      return;
    }

    if (!isSortable(source)) return;
    const destination = getBookmarkReorderDestination(
      source,
      sourceData.container.id,
    );
    if (!destination) return;
    // 排序结果属于 source；结束瞬间 target 可能为空，不能因此跳过 Chrome 写入。
    runBookmarkMutation(
      platform.bookmarks.move(sourceData.node.id, destination),
    );
  }

  function openFolderNode(folder: BrowserBookmarkFolder) {
    navigateToFolder(folder.id);
  }

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: [
            // 与旧 Launcher 一致：移动超过 8px 才开始拖拽，普通点击仍会打开书签。
            new PointerActivationConstraints.Distance({ value: 8 }),
          ],
        }),
      ]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="relative z-10 mx-auto flex min-h-[15rem] w-full max-w-6xl flex-1 flex-col pt-12 sm:pt-5">
          <div className="shrink-0 px-6 sm:px-10">
            <BookmarkBreadcrumb
              path={currentPath}
              editTitleInitially={renameFolderId === currentFolder.id}
              onNavigate={(folder) => {
                if (folder.id === activeRoot.id) {
                  navigateToFolder(null);
                } else {
                  openFolderNode(folder);
                }
              }}
              onRename={(title) => {
                runBookmarkMutation(
                  platform.bookmarks.update(currentFolder.id, { title }),
                );
                setRenameFolderId(null);
              }}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_2rem),transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_2rem),transparent_100%)] [scrollbar-width:none] sm:px-10">
            {/* 书签网格独立居中，数量较少时仍保持新标签页的视觉重心。 */}
            <ul
              className="grid justify-center gap-x-3 gap-y-5 sm:gap-x-4"
              style={{
                gridTemplateColumns: `repeat(auto-fit, ${Math.round(
                  // 与旧网格使用同一个节点缩放值，避免列宽变化影响拖拽阈值。
                  88 * nodeScale,
                )}px)`,
              }}
            >
              {currentFolder.children.map((node, index) => (
                <BookmarkNodeCard
                  key={`${node.id}:${
                    revealedBookmark?.bookmarkId === node.id
                      ? revealedBookmark?.revealKey
                      : ""
                  }`}
                  node={node}
                  index={index}
                  group={currentFolder.id}
                  container={{
                    type:
                      currentFolder.id === activeRoot.id ? "root" : "folder",
                    id: currentFolder.id,
                  }}
                  isRenaming={renameFolderId === node.id}
                  isLocated={revealedBookmark?.bookmarkId === node.id}
                  onOpen={() => {
                    if (node.type === "folder") openFolderNode(node);
                  }}
                  onEdit={() => {
                    if (node.type === "folder") {
                      setRenameFolderId(node.id);
                    } else {
                      setEditor({ mode: "edit", node });
                    }
                  }}
                  onRename={(title) => {
                    runBookmarkMutation(
                      platform.bookmarks.update(node.id, { title }),
                    );
                    setRenameFolderId(null);
                  }}
                  onCancelRename={() => setRenameFolderId(null)}
                  onDelete={() => setPendingDelete(node)}
                />
              ))}
              {isModifiableFolder(currentFolder) ? (
                <AddBookmarkButton
                  onClick={() =>
                    setEditor({
                      mode: "create-item",
                      parentId: currentFolder.id,
                    })
                  }
                />
              ) : null}
            </ul>
          </div>
        </section>

        <nav
          className="z-20 flex shrink-0 justify-center px-4 pb-8 pt-3 sm:pb-12 md:pb-16"
          aria-label={t("launcher.bookmarkRoots")}
        >
          {/* 每个根目录独立成组，避免额外的外层玻璃容器抢占视觉层级。 */}
          <span className="flex max-w-[calc(100vw-2rem)] items-center gap-2.5 overflow-x-auto p-1.5 [scrollbar-width:none]">
            {roots.map((root) => {
              const isActive = root.id === activeRoot.id;
              return (
                <BookmarkRootDropTarget
                  key={root.id}
                  root={root}
                  active={isActive}
                  onSelect={() => selectRoot(root.id)}
                />
              );
            })}
          </span>
        </nav>
      </div>

      {/* 独立浮层保留旧版拖拽时的跟手预览，不受网格占位透明度影响。 */}
      <DragOverlay>
        {activeNode ? <DraggedNodePreview node={activeNode} /> : null}
      </DragOverlay>

      {editor ? (
        <BookmarkEditorDialog state={editor} onClose={() => setEditor(null)} />
      ) : null}
      {pendingDelete ? (
        pendingDelete.type === "folder" ? (
          <DeleteBookmarkCollectionDialog
            title={t("launcher.deleteFolder")}
            collectionName={pendingDelete.title}
            itemCount={pendingDelete.children.length}
            keepItemsLabel={t("launcher.keepFolderItems")}
            deleteAllLabel={t("launcher.deleteFolderAll")}
            onClose={() => setPendingDelete(null)}
            onKeepItems={() => {
              runBookmarkMutation(
                deleteFolderKeepingContents(platform.bookmarks, pendingDelete),
              );
              setPendingDelete(null);
            }}
            onDeleteAll={() => {
              runBookmarkMutation(platform.bookmarks.remove(pendingDelete.id));
              setPendingDelete(null);
            }}
          />
        ) : (
          <DeleteBookmarkDialog
            node={pendingDelete}
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              runBookmarkMutation(platform.bookmarks.remove(pendingDelete.id));
              setPendingDelete(null);
            }}
          />
        )
      ) : null}
    </DragDropProvider>
  );
}
