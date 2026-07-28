/**
 * 启动器交互说明：
 *
 * - 点击书签会打开对应页面；点击文件夹会打开文件夹对话框。
 * - 主页中的书签和文件夹均可拖拽排序。
 * - 主页书签可拖到另一个书签或文件夹上进行合并：
 *   两个书签会组成新文件夹，书签拖到已有文件夹上则加入该文件夹。
 * - 文件夹内的书签可独立拖拽排序。
 * - 将文件夹内的书签拖出文件夹边界，会立即关闭文件夹对话框；本次拖拽
 *   继续进行，可直接把该书签放到主页中的目标位置。
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefObject,
  type ReactNode,
} from "react";
import {
  DragDropProvider,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { type SortableDraggable } from "@dnd-kit/dom/sortable";
import { move } from "@dnd-kit/helpers";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import clsx from "clsx";
import { ChevronRight, EllipsisVertical, Plus } from "lucide-react";
import {
  createBookmarkSortableGroups,
  mergeBookmarkIntoNode,
  resolveBookmarkSortableGroups,
  type LauncherBookmarkFolder,
  type LauncherBookmarkItem,
  type LauncherBookmarkNode,
  type LauncherBookmarkCategory,
} from "./bookmarkLayout";
import { platform } from "@platform";
import { Dialog, DialogTitle } from "../components/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../components/DropdownMenu";
import { SiteIcon } from "../components/SiteIcon";
import { useSettings } from "../Settings/SettingsProvider";
import { useTranslation } from "react-i18next";
import { DeleteBookmarkCollectionDialog } from "./DeleteBookmarkCollectionDialog";

type SortableCollisionDetector = NonNullable<
  Parameters<typeof useSortable>[0]["collisionDetector"]
>;
const MERGE_TARGET_PREFIX = "merge:";
// dnd-kit 用 group 区分多个 sortable 容器：主页是 root，每个 Folder 使用自身 ID。
const ROOT_SORTABLE_GROUP = "root";
const BookmarkCategoriesContext = createContext<{
  categories: LauncherBookmarkCategory[];
  categoryId: string;
}>({ categories: [], categoryId: "" });

function reportBookmarkMutation(promise: Promise<unknown>, action: string) {
  void promise.catch((error: unknown) => {
    console.error(`Failed to ${action} browser bookmark`, error);
  });
}

type BookmarkContainer =
  | { type: "root"; id: typeof ROOT_SORTABLE_GROUP }
  | { type: "folder"; id: string };

/**
 * 与 draggable/droppable 绑定的稳定业务上下文。
 * node/container 用于识别业务对象；会变化的位置只读取 sortable.group/index。
 */
type BookmarkDndData = Record<string, unknown> & {
  node: LauncherBookmarkNode;
  container: BookmarkContainer;
  folderPanelRef?: RefObject<HTMLDivElement | null>;
};

function getBookmarkDndData(
  entity: { data: Record<string, unknown> } | null | undefined,
): BookmarkDndData | null {
  const data = entity?.data as Partial<BookmarkDndData> | undefined;
  return data?.node && data.container ? (data as BookmarkDndData) : null;
}

function getMergeTargetId(itemId: string) {
  return `${MERGE_TARGET_PREFIX}${itemId}`;
}

/**
 * 判断被拖拽的 A 是否应该移动到候选项 B 的位置。
 *
 * A 刚与 B 重叠时不排序；只有 A 的中心移动到 B 的中心位置或更远时，
 * 才把 B 返回给 dnd-kit，让它更新 A 的占位。
 *
 * 每次占位更新后，下一次判断都从 A 的新占位重新开始，而不是一直使用
 * A 在整次拖拽开始时的位置。
 */
const reorderCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  // A 当前跟随手指移动的位置。
  const source = dragOperation.source;
  const sourceCurrent = dragOperation.shape?.current;

  // Dialog 覆盖在主页网格上方，但碰撞系统仍能看到遮罩后的 root sortables。
  // 指针还在 Folder 面板内时忽略这些候选项；一旦越界，立即选择离指针最近的
  // root sortable，让 onDragOver 投影数据并关闭 Dialog，无需等待拖拽项与目标重叠。
  if (
    source &&
    "sortable" in source &&
    "sortable" in droppable &&
    (source as unknown as SortableDraggable<Record<string, unknown>>).sortable
      .group !== ROOT_SORTABLE_GROUP &&
    (droppable as unknown as { sortable: { group?: unknown } }).sortable
      .group === ROOT_SORTABLE_GROUP
  ) {
    const panel = getBookmarkDndData(source)?.folderPanelRef?.current;
    const pointer = dragOperation.position.current;
    const rect = panel?.getBoundingClientRect();
    if (!rect) return null;
    if (
      pointer.x >= rect.left &&
      pointer.x <= rect.right &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom
    ) {
      return null;
    }

    const target = droppable.shape;
    if (!target) return null;

    const distanceToTarget = Math.hypot(
      pointer.x - target.center.x,
      pointer.y - target.center.y,
    );
    return {
      id: droppable.id,
      priority: 2,
      type: 1,
      value: 1 / (distanceToTarget + 1),
    };
  }

  // B 是 dnd-kit 本轮正在检查的候选项。
  const target = droppable.shape;

  // 缺少位置、拖拽源不是可排序项，或者 B 就是 A 自己时，都不能排序。
  if (
    !source ||
    !("sortable" in source) ||
    !sourceCurrent ||
    !target ||
    source.id === droppable.id
  ) {
    return null;
  }

  // placeholder 是 A 在列表里的当前占位。发生一次预排序后，这个位置也会更新。
  const sortableSource = source as unknown as SortableDraggable<
    Record<string, unknown>
  >;
  const placeholder = sortableSource.sortable.droppable.shape;
  if (!placeholder) return null;

  // A 还没有碰到 B 时，不把 B 当作排序目标。
  if (sourceCurrent.intersectionArea(target) === 0) return null;

  const placeholderCenter = placeholder.center;
  const currentCenter = sourceCurrent.center;
  const targetCenter = target.center;

  // 从 A 的当前占位指向 B，得到本轮拖动的判断方向。
  const targetX = targetCenter.x - placeholderCenter.x;
  const targetY = targetCenter.y - placeholderCenter.y;
  const targetDistanceSquared = targetX ** 2 + targetY ** 2;

  if (targetDistanceSquared === 0) return null;

  // progress 表示 A 沿“当前占位 → B”方向移动了多远：
  // 0 = 仍在当前占位中心，0.5 = 走到一半，1 = 到达 B 的中心。
  const progress =
    ((currentCenter.x - placeholderCenter.x) * targetX +
      (currentCenter.y - placeholderCenter.y) * targetY) /
    targetDistanceSquared;

  // A 尚未到达 B 的中心，保留现有占位，不触发排序。
  if (progress < 1) return null;

  const distanceToTarget = Math.hypot(
    currentCenter.x - targetCenter.x,
    currentCenter.y - targetCenter.y,
  );

  // A 已经到达或越过 B 的中心：返回 C，并优先选择离 A 最近的候选项。
  return {
    id: droppable.id,
    // 2 和 1 分别对应 dnd-kit 的 Normal 与 ShapeIntersection。
    priority: 2,
    type: 1,
    value: 1 / (distanceToTarget + 1),
  };
};

/** 独立的中心 droppable 只表达合并，不参与 sortable 的位置交换。 */
const mergeCollisionDetector: SortableCollisionDetector = ({
  dragOperation,
  droppable,
}) => {
  const source = dragOperation.source;
  const sourceData = getBookmarkDndData(source);
  const target = droppable.shape;
  const pointer = dragOperation.position.current;
  const sourceMergeTargetId = source
    ? getMergeTargetId(String(source.id))
    : null;

  if (
    sourceData?.node.type !== "item" ||
    sourceData.container.type !== "root" ||
    sourceMergeTargetId === droppable.id ||
    !target
  ) {
    return null;
  }

  const rect = target.boundingRectangle;
  if (
    pointer.x >= rect.left &&
    pointer.x <= rect.right &&
    pointer.y >= rect.top &&
    pointer.y <= rect.bottom
  ) {
    const distanceToTarget = Math.hypot(
      pointer.x - target.center.x,
      pointer.y - target.center.y,
    );

    return {
      id: droppable.id,
      // 合并区域优先于同时命中的外层排序区域。
      priority: 4,
      type: 2,
      value: 1 / (distanceToTarget + 1),
    };
  }

  return null;
};

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
    <div
      className="relative shrink-0"
      style={{ width: 64 * nodeScale, height: 64 * nodeScale }}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/30 shadow-[0_18px_35px_rgba(15,23,42,0.22)] transition-all duration-200 ease-out"
        style={{
          width: (active ? 72 : 64) * nodeScale,
          height: (active ? 72 : 64) * nodeScale,
          borderRadius: (active ? 22 : 18) * nodeScale,
        }}
      />
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        {children}
      </div>
    </div>
  );
}

function BookmarkPreview({
  bookmark,
  hideTitle = false,
  isMergeTarget = false,
}: {
  bookmark: LauncherBookmarkItem;
  hideTitle?: boolean;
  isMergeTarget?: boolean;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  const previewStyle: CSSProperties = {
    width: 80 * nodeScale,
    gap: 8 * nodeScale,
  };
  const iconStyle: CSSProperties = {
    width: 64 * nodeScale,
    height: 64 * nodeScale,
    borderRadius: 18 * nodeScale,
    fontSize: 24 * nodeScale,
  };

  return (
    <div
      className="flex flex-col items-center text-center"
      style={previewStyle}
    >
      <MergeTargetFrame active={isMergeTarget}>
        <SiteIcon
          title={bookmark.title}
          url={bookmark.url}
          seed={bookmark.id}
          className="font-bold shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
          style={iconStyle}
        />
      </MergeTargetFrame>
      <span
        className={clsx(
          "line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
          hideTitle && "invisible",
        )}
      >
        {bookmark.title}
      </span>
    </div>
  );
}

function BookmarkLink({
  bookmark,
  dragHandleRef,
  isDragging,
  isMergeTarget,
}: {
  bookmark: LauncherBookmarkItem;
  dragHandleRef: Ref<HTMLAnchorElement>;
  isDragging: boolean;
  isMergeTarget?: boolean;
}) {
  return (
    <a
      ref={dragHandleRef}
      className="flex touch-none select-none justify-center rounded-[30px] outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
      href={bookmark.url}
      target="_parent"
      rel="noreferrer"
    >
      <BookmarkPreview
        bookmark={bookmark}
        hideTitle={isDragging}
        isMergeTarget={isMergeTarget}
      />
    </a>
  );
}

function FolderPreview({
  folder,
  hideTitle = false,
  isMergeTarget = false,
}: {
  folder: LauncherBookmarkFolder;
  hideTitle?: boolean;
  isMergeTarget?: boolean;
}) {
  const {
    settings: { nodeScale },
  } = useSettings();
  const previewStyle: CSSProperties = {
    width: 80 * nodeScale,
    gap: 8 * nodeScale,
  };
  const iconStyle: CSSProperties = {
    width: 64 * nodeScale,
    height: 64 * nodeScale,
    borderRadius: 18 * nodeScale,
    gap: 4 * nodeScale,
    padding: 8 * nodeScale,
  };

  return (
    <div
      className="flex flex-col items-center text-center"
      style={previewStyle}
    >
      <MergeTargetFrame active={isMergeTarget}>
        <div className="grid grid-cols-2 grid-rows-2" style={iconStyle}>
          {folder.children.slice(0, 4).map((item) => (
            <SiteIcon
              key={item.id}
              title={item.title}
              url={item.url}
              seed={item.id}
              className="size-full min-h-0 min-w-0 font-bold shadow-sm"
              style={{
                borderRadius: 8 * nodeScale,
                fontSize: 10 * nodeScale,
              }}
            />
          ))}
        </div>
      </MergeTargetFrame>
      <span
        className={clsx(
          "line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
          hideTitle && "invisible",
        )}
      >
        {folder.title}
      </span>
    </div>
  );
}

function NodePreview({
  node,
  hideTitle = false,
}: {
  node: LauncherBookmarkNode;
  hideTitle?: boolean;
}) {
  return node.type === "item" ? (
    <BookmarkPreview bookmark={node} hideTitle={hideTitle} />
  ) : (
    <FolderPreview folder={node} hideTitle={hideTitle} />
  );
}

function SortableNode({
  node,
  index,
  onOpenFolder,
  onEdit,
  onDelete,
  onMove,
}: {
  node: LauncherBookmarkNode;
  index: number;
  onOpenFolder: (folder: LauncherBookmarkFolder) => void;
  onEdit: (node: LauncherBookmarkNode) => void;
  onDelete: (node: LauncherBookmarkNode) => void;
  onMove: (node: LauncherBookmarkNode, categoryId: string) => void;
}) {
  const dndData: BookmarkDndData = {
    node,
    container: { type: "root", id: ROOT_SORTABLE_GROUP },
  };
  const { ref, handleRef, isDragging } = useSortable<BookmarkDndData>({
    id: node.id,
    index,
    group: ROOT_SORTABLE_GROUP,
    type: node.type,
    data: dndData,
    collisionDetector: reorderCollisionDetector,
  });
  const { ref: mergeRef, isDropTarget: isMergeTarget } =
    useDroppable<BookmarkDndData>({
      id: getMergeTargetId(node.id),
      type: "merge",
      data: dndData,
      collisionDetector: mergeCollisionDetector,
    });

  return (
    <li
      ref={ref}
      className={clsx(
        "group relative rounded-[30px] transition will-change-transform",
        isDragging && "opacity-30",
      )}
    >
      <div
        ref={mergeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      <NodeMenu
        node={node}
        onEdit={() => onEdit(node)}
        onDelete={() => onDelete(node)}
        onMove={(categoryId) => onMove(node, categoryId)}
      />
      {node.type === "item" ? (
        <BookmarkLink
          bookmark={node}
          dragHandleRef={handleRef}
          isDragging={isDragging}
          isMergeTarget={isMergeTarget}
        />
      ) : (
        <button
          ref={handleRef}
          type="button"
          className="flex touch-none select-none justify-center rounded-[30px] outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          onClick={() => onOpenFolder(node)}
        >
          <FolderPreview
            folder={node}
            hideTitle={isDragging}
            isMergeTarget={isMergeTarget}
          />
        </button>
      )}
    </li>
  );
}

function FolderDialog({
  folder,
  isClosing,
  onClose,
  onRename,
  editTitleInitially,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  panelRef,
}: {
  folder: LauncherBookmarkFolder;
  isClosing: boolean;
  onClose: () => void;
  onRename: (title: string) => void;
  editTitleInitially: boolean;
  onEditItem: (item: LauncherBookmarkItem) => void;
  onDeleteItem: (item: LauncherBookmarkItem) => void;
  onMoveItem: (item: LauncherBookmarkItem, categoryId: string) => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(folder.title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(folder.title);
    setIsEditingTitle(editTitleInitially);
    if (editTitleInitially) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [editTitleInitially, folder.id, folder.title]);

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

  return (
    <Dialog
      contentRef={panelRef}
      isClosing={isClosing}
      onClose={onClose}
      className="max-w-xl p-7"
    >
      {(close) => (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold text-white">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  className="min-w-0 rounded-lg bg-white/10 px-2 py-1 text-inherit outline-none ring-2 ring-white/60 [font:inherit]"
                  value={title}
                  aria-label={t("launcher.folderTitle")}
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
              ) : (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-left outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
                  onClick={() => {
                    setIsEditingTitle(true);
                    requestAnimationFrame(() => {
                      titleInputRef.current?.focus();
                      titleInputRef.current?.select();
                    });
                  }}
                >
                  {folder.title}
                </button>
              )}
            </DialogTitle>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-5 gap-y-7">
            {folder.children.map((item, index) => (
              <FolderSortableItem
                key={item.id}
                folderId={folder.id}
                item={item}
                index={index}
                folderPanelRef={panelRef}
                onEdit={() => onEditItem(item)}
                onDelete={() => {
                  onDeleteItem(item);
                  if (folder.children.length === 1) close();
                }}
                onMove={(categoryId) => {
                  onMoveItem(item, categoryId);
                  if (folder.children.length === 1) close();
                }}
              />
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

function FolderSortableItem({
  folderId,
  item,
  index,
  folderPanelRef,
  onEdit,
  onDelete,
  onMove,
}: {
  folderId: string;
  item: LauncherBookmarkItem;
  index: number;
  folderPanelRef: RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (categoryId: string) => void;
}) {
  // group/index 是 dnd-kit 管理跨容器排序的核心数据。子项沿用自身 ID；移到
  // root 后，顶层 SortableNode 会用相同 ID 重新注册并接续当前 operation。
  const { ref, handleRef, isDragging } = useSortable<BookmarkDndData>({
    id: item.id,
    index,
    group: folderId,
    type: "folder-item",
    data: {
      node: item,
      container: { type: "folder", id: folderId },
      folderPanelRef,
    },
    collisionDetector: reorderCollisionDetector,
  });

  return (
    <li
      ref={ref}
      className={clsx(
        "group relative rounded-[30px] transition will-change-transform",
        isDragging && "opacity-30",
      )}
    >
      <NodeMenu
        node={item}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
      />
      <BookmarkLink
        bookmark={item}
        dragHandleRef={handleRef}
        isDragging={isDragging}
      />
    </li>
  );
}

function NodeMenu({
  node,
  onEdit,
  onDelete,
  onMove,
}: {
  node: LauncherBookmarkNode;
  onEdit: () => void;
  onDelete?: () => void;
  onMove?: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const {
    settings: { nodeScale },
  } = useSettings();
  const { categories, categoryId } = useContext(BookmarkCategoriesContext);

  return (
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
          <DropdownMenuContent className="min-w-44">
            <DropdownMenuItem onSelect={onEdit}>
              {t(node.type === "folder" ? "launcher.editTitle" : "common.edit")}
            </DropdownMenuItem>
            {onMove && categories.length > 1 ? (
              <DropdownMenu.Sub>
                <DropdownMenuSubTrigger>
                  <span className="flex-1">{t("launcher.moveToCategory")}</span>
                  <ChevronRight
                    className="size-3.5"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </DropdownMenuSubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenuSubContent>
                    {categories
                      .filter((category) => category.id !== categoryId)
                      .map((category) => (
                        <DropdownMenuItem
                          key={category.id}
                          onSelect={() => onMove(category.id)}
                        >
                          {category.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem variant="danger" onSelect={onDelete}>
                {t(
                  node.type === "folder"
                    ? "launcher.deleteFolder"
                    : "common.delete",
                )}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function EditItemDialog({
  item,
  onClose,
  onSave,
}: {
  item: LauncherBookmarkItem;
  onClose: () => void;
  onSave: (title: string, url: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog onClose={onClose} className="max-w-md p-7">
      {(close) => (
        <>
          <DialogTitle className="mb-6 text-xl font-bold">
            {t("launcher.editBookmark")}
          </DialogTitle>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              const nextTitle = title.trim();
              const nextUrl = url.trim();
              if (nextTitle && nextUrl) {
                onSave(nextTitle, nextUrl);
                close();
              }
            }}
          >
            <label className="block space-y-2 text-sm font-medium">
              <span>{t("launcher.name")}</span>
              <input
                ref={titleInputRef}
                autoFocus
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/60"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>{t("launcher.url")}</span>
              <input
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/60"
              />
            </label>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}

function AddItemDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (title: string, url: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  return (
    <Dialog onClose={onClose} className="max-w-md p-7">
      {(close) => (
        <>
          <DialogTitle className="mb-6 text-xl font-bold">
            {t("launcher.addBookmark")}
          </DialogTitle>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              const nextUrl = url.trim();
              if (!nextUrl) return;

              const nextTitle = title.trim() || new URL(nextUrl).hostname;
              onSave(nextTitle, nextUrl);
              close();
            }}
          >
            <label className="block space-y-2 text-sm font-medium">
              <span>{t("launcher.name")}</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/60"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>{t("launcher.url")}</span>
              <input
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/60"
              />
            </label>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-4 py-2.5 font-semibold transition hover:bg-white/10"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {t("launcher.done")}
              </button>
            </div>
          </form>
        </>
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

export function BookmarkPage({
  categoryId,
  bookmarks: storedBookmarks,
  categories,
  onChange,
  onAdd,
  onMove,
}: {
  categoryId: string;
  bookmarks: LauncherBookmarkNode[];
  categories: LauncherBookmarkCategory[];
  onChange: (bookmarks: LauncherBookmarkNode[]) => void;
  onAdd: (bookmark: LauncherBookmarkItem) => void;
  onMove: (
    sourceBookmarks: LauncherBookmarkNode[],
    bookmark: LauncherBookmarkNode,
    targetCategoryId: string,
  ) => void;
}) {
  const { t } = useTranslation();
  const {
    settings: { nodeScale },
  } = useSettings();
  const [bookmarks, setBookmarks] = useState(storedBookmarks);
  const bookmarksRef = useRef(storedBookmarks);
  // 预览直接使用 draggable.data.node，不再用 ID 回到业务数组做二次查找。
  const [activeNode, setActiveNode] = useState<LauncherBookmarkNode | null>(
    null,
  );
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LauncherBookmarkItem | null>(
    null,
  );
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<LauncherBookmarkFolder | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  // 越界后业务数据会立即迁移到 root；这份不含拖拽项的快照仅用于
  // 让 Dialog 播完关闭动画，也覆盖空 Folder 已被业务数据删除的情况。
  const [closingFolder, setClosingFolder] =
    useState<LauncherBookmarkFolder | null>(null);
  // 碰撞检测用真实面板隔离遮罩后的 root sortables；Dialog 卸载时会自动清空 ref。
  const folderPanelRef = useRef<HTMLDivElement | null>(null);
  // DragStart 快照只用于 canceled 时回滚尚未保存的跨 group 投影。
  const dragStartBookmarksRef = useRef<LauncherBookmarkNode[] | null>(null);
  // 同一轮 dragover 可能重复报告 root target，只投影一次容器切换。
  const projectedToRootItemIdRef = useRef<string | null>(null);

  const saveBookmarks = useCallback(
    (nextBookmarks: LauncherBookmarkNode[]) => {
      bookmarksRef.current = nextBookmarks;
      setBookmarks(nextBookmarks);
      onChange(nextBookmarks);
    },
    [onChange],
  );

  useEffect(() => {
    bookmarksRef.current = storedBookmarks;
    setBookmarks(storedBookmarks);
  }, [storedBookmarks]);

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source;
    const sourceData = getBookmarkDndData(source);
    if (!source || !sourceData) return;

    setActiveNode(sourceData.node);
    // 保存业务数据快照。dnd-kit 会在 DOM 层回滚 canceled operation，React 数据
    // 也必须恢复到同一版本，二者才能保持一致。
    dragStartBookmarksRef.current = bookmarks;
    projectedToRootItemIdRef.current = null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { source, target } = event.operation;
    const sourceData = getBookmarkDndData(source);
    const targetData = getBookmarkDndData(target);
    if (
      !isSortable(source) ||
      !isSortable(target) ||
      sourceData?.container.type !== "folder" ||
      targetData?.container.type !== "root" ||
      projectedToRootItemIdRef.current !== null ||
      sourceData.container.id !== openFolderId ||
      target.sortable.group !== ROOT_SORTABLE_GROUP
    ) {
      return;
    }

    // 跨 group 时由 React 投影数据，禁止 OptimisticSortingPlugin 再通过
    // insertAdjacentElement 直接迁移同一个 DOM 节点。否则 React 随后卸载
    // Folder 子树时会从旧父节点 removeChild，触发 NotFoundError。
    event.preventDefault();
    projectedToRootItemIdRef.current = sourceData.node.id;
    const projectedGroups = move(
      createBookmarkSortableGroups(bookmarks, ROOT_SORTABLE_GROUP),
      event,
    );
    const projectedBookmarks: LauncherBookmarkNode[] =
      resolveBookmarkSortableGroups(projectedGroups, ROOT_SORTABLE_GROUP);
    bookmarksRef.current = projectedBookmarks;
    setBookmarks(projectedBookmarks);

    const projectedFolder = projectedBookmarks.find(
      (node): node is LauncherBookmarkFolder =>
        node.type === "folder" && node.id === sourceData.container.id,
    );
    const currentFolder = bookmarks.find(
      (node): node is LauncherBookmarkFolder =>
        node.type === "folder" && node.id === sourceData.container.id,
    );
    setClosingFolder(
      projectedFolder ??
        (currentFolder
          ? {
              ...currentFolder,
              children: currentFolder.children.filter(
                (item) => item.id !== sourceData.node.id,
              ),
            }
          : null),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    // 无论是否完成排序，拖拽结束后都要关闭浮层预览。
    setActiveNode(null);

    const sourceData = getBookmarkDndData(event.operation.source);
    const finalTarget = event.operation.target;
    const targetData = getBookmarkDndData(finalTarget);

    if (event.canceled) {
      // 跨 group 的投影尚未写入存储，取消时恢复 DragStart 的 React 快照即可。
      if (projectedToRootItemIdRef.current) {
        const restoredBookmarks = dragStartBookmarksRef.current ?? bookmarks;
        bookmarksRef.current = restoredBookmarks;
        setBookmarks(restoredBookmarks);
      }
      return;
    }

    if (
      finalTarget?.type === "merge" &&
      sourceData?.node.type === "item" &&
      targetData
    ) {
      // 合并双方都直接来自 dnd operation.data；ID 仅作为持久化层的节点键。
      const nextCategoryBookmarks = mergeBookmarkIntoNode(
        bookmarks,
        sourceData.node.id,
        targetData.node.id,
        `folder:${crypto.randomUUID()}`,
        t("launcher.folder"),
      );
      if (nextCategoryBookmarks !== bookmarks) {
        saveBookmarks(nextCategoryBookmarks);
      }
      return;
    }

    const source = event.operation.source;
    if (!isSortable(source)) return;

    // Folder 内排序直接更新业务树中的 children。界面上的 optimistic sorting
    // 不会修改 React 数据；这里必须把 source 的最终 index 明确写回对应 Folder。
    if (
      sourceData?.container.type === "folder" &&
      source.initialGroup === source.group
    ) {
      const folderId = sourceData.container.id;
      const nextBookmarks = bookmarksRef.current.map((node) => {
        if (node.type !== "folder" || node.id !== folderId) return node;

        const children = [...node.children];
        const sourceIndex = children.findIndex(
          (item) => item.id === sourceData.node.id,
        );
        if (sourceIndex < 0) return node;

        const [item] = children.splice(sourceIndex, 1);
        if (!item) return node;
        children.splice(source.index, 0, item);
        return { ...node, children };
      });
      saveBookmarks(nextBookmarks);
      return;
    }

    // Folder Item 跨到 root 时，onDragOver 已经把最终结构投影进 React state；
    // 此处只持久化该结构，不能再对同一个 event 执行一次 move()。
    if (projectedToRootItemIdRef.current) {
      saveBookmarks(bookmarksRef.current);
      return;
    }

    // Root 内的 optimistic sorting 已经把 source.index 推进到最终占位，不能再对
    // 同一个 event 调用 move()，否则会把已完成的移动重复应用并保存成旧顺序。
    // 业务 state 尚未参与 optimistic sorting，因此按节点 ID 和最终 index 明确重排。
    const currentBookmarks = bookmarksRef.current;
    const sourceIndex = currentBookmarks.findIndex(
      (node) => node.id === sourceData?.node.id,
    );
    if (sourceIndex < 0) return;

    const nextBookmarks = [...currentBookmarks];
    const [node] = nextBookmarks.splice(sourceIndex, 1);
    if (!node) return;
    nextBookmarks.splice(source.index, 0, node);
    saveBookmarks(nextBookmarks);
  }

  const openFolder = openFolderId
    ? bookmarks.find(
        (node): node is LauncherBookmarkFolder =>
          node.type === "folder" && node.id === openFolderId,
      )
    : undefined;
  const displayedFolder = closingFolder ?? openFolder;

  return (
    <BookmarkCategoriesContext.Provider value={{ categories, categoryId }}>
      <DragDropProvider
        sensors={(defaults) => [
          ...defaults.filter((sensor) => sensor !== PointerSensor),
          PointerSensor.configure({
            activationConstraints: [
              // 移动超过 8px 才开始拖拽，避免普通单击被识别为拖拽。
              new PointerActivationConstraints.Distance({ value: 8 }),
            ],
          }),
        ]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <section className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 pb-8 pt-12 sm:px-10 sm:pt-14">
          <ul
            className="grid justify-center gap-x-3 gap-y-5 sm:gap-x-4"
            style={{
              gridTemplateColumns: `repeat(auto-fit, ${Math.round(88 * nodeScale)}px)`,
            }}
          >
            {bookmarks.map((node, index) => (
              <SortableNode
                key={node.id}
                node={node}
                index={index}
                onOpenFolder={(folder) => {
                  setClosingFolder(null);
                  setRenameFolderId(null);
                  setOpenFolderId(folder.id);
                }}
                onEdit={(selectedNode) => {
                  if (selectedNode.type === "folder") {
                    setClosingFolder(null);
                    setRenameFolderId(selectedNode.id);
                    setOpenFolderId(selectedNode.id);
                  } else {
                    setEditingItem(selectedNode);
                  }
                }}
                onDelete={(selectedNode) => {
                  if (selectedNode.type === "folder") {
                    setPendingDeleteFolder(selectedNode);
                    return;
                  }
                  void platform.bookmarks.remove(selectedNode.id).then(
                    () => {
                      saveBookmarks(
                        bookmarksRef.current.filter(
                          (candidate) => candidate.id !== selectedNode.id,
                        ),
                      );
                    },
                    (error: unknown) => {
                      console.error("Failed to remove browser bookmark", error);
                    },
                  );
                }}
                onMove={(selectedNode, categoryId) => {
                  const sourceBookmarks = bookmarks.filter(
                    (candidate) => candidate.id !== selectedNode.id,
                  );
                  bookmarksRef.current = sourceBookmarks;
                  setBookmarks(sourceBookmarks);
                  onMove(sourceBookmarks, selectedNode, categoryId);
                }}
              />
            ))}
            <AddBookmarkButton onClick={() => setIsAddingItem(true)} />
          </ul>
        </section>
        {/* 使用独立浮层展示拖拽项，避免受到列表布局和透明度样式影响。 */}
        <DragOverlay>
          {activeNode ? (
            <div className="rotate-1 scale-105 drop-shadow-2xl">
              <NodePreview node={activeNode} hideTitle />
            </div>
          ) : null}
        </DragOverlay>
        {pendingDeleteFolder ? (
          <DeleteBookmarkCollectionDialog
            title={t("launcher.deleteFolder")}
            collectionName={pendingDeleteFolder.title}
            bookmarkCount={pendingDeleteFolder.children.length}
            keepBookmarksLabel={t("launcher.keepFolderBookmarks")}
            deleteAllLabel={t("launcher.deleteFolderAll")}
            onClose={() => setPendingDeleteFolder(null)}
            onKeepBookmarks={() => {
              saveBookmarks(
                bookmarksRef.current.flatMap((node) =>
                  node.id === pendingDeleteFolder.id
                    ? pendingDeleteFolder.children
                    : [node],
                ),
              );
              setPendingDeleteFolder(null);
            }}
            onDeleteAll={() => {
              const folderId = pendingDeleteFolder.id;
              const children = pendingDeleteFolder.children;
              void Promise.allSettled(
                children.map((item) => platform.bookmarks.remove(item.id)),
              ).then((results) => {
                const removedIds = new Set(
                  results.flatMap((result, index) =>
                    result.status === "fulfilled" ? [children[index].id] : [],
                  ),
                );
                const errors = results.flatMap((result) =>
                  result.status === "rejected" ? [result.reason] : [],
                );
                if (errors.length > 0) {
                  console.error(
                    "Failed to remove some folder bookmarks",
                    errors,
                  );
                }

                // 只从布局移除 Chrome 已确认删除的项，失败项继续留在原 Folder。
                saveBookmarks(
                  bookmarksRef.current.flatMap((node) => {
                    if (node.type !== "folder" || node.id !== folderId) {
                      return [node];
                    }
                    const remaining = node.children.filter(
                      (item) => !removedIds.has(item.id),
                    );
                    return remaining.length
                      ? [{ ...node, children: remaining }]
                      : [];
                  }),
                );
                setPendingDeleteFolder(null);
              });
            }}
          />
        ) : null}
        {displayedFolder ? (
          <FolderDialog
            folder={displayedFolder}
            isClosing={closingFolder !== null}
            editTitleInitially={renameFolderId === displayedFolder.id}
            onEditItem={setEditingItem}
            onDeleteItem={(item) => {
              const folderId = displayedFolder.id;
              void platform.bookmarks.remove(item.id).then(
                () => {
                  const nextBookmarks = bookmarksRef.current
                    .filter(
                      (node) =>
                        node.type !== "folder" ||
                        node.id !== folderId ||
                        node.children.length > 1,
                    )
                    .map((node) =>
                      node.type === "folder" && node.id === folderId
                        ? {
                            ...node,
                            children: node.children.filter(
                              (child) => child.id !== item.id,
                            ),
                          }
                        : node,
                    );
                  saveBookmarks(nextBookmarks);
                },
                (error: unknown) => {
                  console.error("Failed to remove browser bookmark", error);
                },
              );
            }}
            onMoveItem={(item, categoryId) => {
              const nextBookmarks =
                bookmarksRef.current.flatMap<LauncherBookmarkNode>((node) => {
                  if (
                    node.type !== "folder" ||
                    node.id !== displayedFolder.id
                  ) {
                    return [node];
                  }
                  const children = node.children.filter(
                    (child) => child.id !== item.id,
                  );
                  return children.length ? [{ ...node, children }] : [];
                });
              bookmarksRef.current = nextBookmarks;
              setBookmarks(nextBookmarks);
              onMove(nextBookmarks, item, categoryId);
            }}
            onRename={(title) => {
              if (closingFolder) return;
              const nextBookmarks = bookmarksRef.current.map((node) =>
                node.type === "folder" && node.id === displayedFolder.id
                  ? { ...node, title }
                  : node,
              );
              saveBookmarks(nextBookmarks);
            }}
            onClose={() => {
              setClosingFolder(null);
              setRenameFolderId(null);
              setOpenFolderId(null);
            }}
            panelRef={folderPanelRef}
          />
        ) : null}
        {editingItem ? (
          <EditItemDialog
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(title, url) => {
              reportBookmarkMutation(
                platform.bookmarks.update(editingItem.id, { title, url }),
                "update",
              );
              const nextBookmarks = bookmarksRef.current.map((node) => {
                if (node.type === "item") {
                  return node.id === editingItem.id
                    ? { ...node, title, url }
                    : node;
                }
                return {
                  ...node,
                  children: node.children.map((item) =>
                    item.id === editingItem.id ? { ...item, title, url } : item,
                  ),
                };
              });
              saveBookmarks(nextBookmarks);
            }}
          />
        ) : null}
        {isAddingItem ? (
          <AddItemDialog
            onClose={() => setIsAddingItem(false)}
            onSave={(title, url) => {
              // Chrome 分配的 bookmark ID 是布局引用的唯一来源，不能预造临时 ID。
              void platform.bookmarks.create({ title, url }).then(
                (item) => {
                  onAdd({ type: "item", ...item });
                },
                (error: unknown) => {
                  console.error("Failed to create browser bookmark", error);
                },
              );
            }}
          />
        ) : null}
      </DragDropProvider>
    </BookmarkCategoriesContext.Provider>
  );
}
