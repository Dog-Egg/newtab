import { useCallback, useEffect, useState } from "react";
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
import { move } from "@dnd-kit/helpers";
import { useSortable } from "@dnd-kit/react/sortable";
import clsx from "clsx";
import { platform } from "@platform";
import {
  mergeShortcutIntoNode,
  type ShortcutFolder,
  type ShortcutItem,
  type ShortcutNode,
} from "./shortcuts";
import { SiteIcon } from "./components/SiteIcon";

type SortableCollisionDetector = NonNullable<
  Parameters<typeof useSortable>[0]["collisionDetector"]
>;
const MERGE_TARGET_PREFIX = "merge:";

function getMergeTargetId(itemId: string) {
  return `${MERGE_TARGET_PREFIX}${itemId}`;
}

function getItemIdFromMergeTarget(id: unknown) {
  const targetId = String(id);
  return targetId.startsWith(MERGE_TARGET_PREFIX)
    ? targetId.slice(MERGE_TARGET_PREFIX.length)
    : null;
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
  const target = droppable.shape;
  const pointer = dragOperation.position.current;
  const sourceMergeTargetId = source
    ? getMergeTargetId(String(source.id))
    : null;

  if (
    source?.type !== "item" ||
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

function ShortcutPreview({
  shortcut,
  hideTitle = false,
}: {
  shortcut: ShortcutItem;
  hideTitle?: boolean;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-3 text-center">
      <SiteIcon
        title={shortcut.title}
        url={shortcut.url}
        seed={shortcut.id}
        className="size-24 rounded-[26px] text-4xl font-bold shadow-[0_18px_35px_rgba(15,23,42,0.22)]"
      />
      <span
        className={clsx(
          "line-clamp-2 min-h-10 w-full text-balance text-sm font-semibold leading-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
          hideTitle && "invisible",
        )}
      >
        {shortcut.title}
      </span>
    </div>
  );
}

function FolderPreview({
  folder,
  hideTitle = false,
}: {
  folder: ShortcutFolder;
  hideTitle?: boolean;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-3 text-center">
      <div className="grid size-24 grid-cols-2 grid-rows-2 gap-1.5 rounded-[26px] bg-white/25 p-3 shadow-[0_18px_35px_rgba(15,23,42,0.22)] backdrop-blur-md">
        {folder.children.slice(0, 4).map((item) => (
          <SiteIcon
            key={item.id}
            title={item.title}
            url={item.url}
            seed={item.id}
            className="size-full min-h-0 min-w-0 rounded-xl text-sm font-bold shadow-sm"
          />
        ))}
      </div>
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
  node: ShortcutNode;
  hideTitle?: boolean;
}) {
  return node.type === "item" ? (
    <ShortcutPreview shortcut={node} hideTitle={hideTitle} />
  ) : (
    <FolderPreview folder={node} hideTitle={hideTitle} />
  );
}

function SortableNode({
  node,
  index,
  onOpenFolder,
}: {
  node: ShortcutNode;
  index: number;
  onOpenFolder: (folder: ShortcutFolder) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: node.id,
    index,
    type: node.type,
    collisionDetector: reorderCollisionDetector,
  });
  const { ref: mergeRef, isDropTarget: isMergeTarget } = useDroppable({
    id: getMergeTargetId(node.id),
    type: "merge",
    collisionDetector: mergeCollisionDetector,
  });

  return (
    <li
      ref={ref}
      className={clsx(
        "relative rounded-[30px] transition will-change-transform",
        isDragging && "opacity-30",
        isMergeTarget &&
          "scale-95 bg-white/15 shadow-[0_0_32px_rgba(255,255,255,0.35)] ring-4 ring-white/80",
      )}
    >
      <div
        ref={mergeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      {node.type === "item" ? (
        <a
          ref={handleRef}
          className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          href={node.url}
          target={import.meta.env.MODE === "web" ? "_parent" : undefined}
          rel={import.meta.env.MODE === "web" ? "noreferrer" : undefined}
        >
          <ShortcutPreview shortcut={node} hideTitle={isDragging} />
        </a>
      ) : (
        <button
          ref={handleRef}
          type="button"
          className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
          onClick={() => onOpenFolder(node)}
        >
          <FolderPreview folder={node} hideTitle={isDragging} />
        </button>
      )}
    </li>
  );
}

function FolderDialog({
  folder,
  onClose,
}: {
  folder: ShortcutFolder;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        // 只有点击遮罩本身时才关闭，点击面板内的快捷方式不能冒泡误关。
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={folder.title}
        className="relative w-full max-w-xl rounded-[32px] border border-white/20 bg-slate-900/80 p-7 shadow-2xl backdrop-blur-2xl"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">{folder.title}</h2>
          <button
            type="button"
            aria-label="关闭文件夹"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/70"
          >
            ×
          </button>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-5 gap-y-7">
          {folder.children.map((item) => (
            <li key={item.id}>
              <a
                className="flex justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
                href={item.url}
                target={import.meta.env.MODE === "web" ? "_parent" : undefined}
                rel={import.meta.env.MODE === "web" ? "noreferrer" : undefined}
              >
                <ShortcutPreview shortcut={item} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Launcher() {
  const [shortcuts, setShortcuts] = useState<ShortcutNode[]>([]);
  // 记录当前拖拽项，用于渲染跟随指针的浮层预览。
  const [activeId, setActiveId] = useState<string | null>(null);

  const [openFolder, setOpenFolder] = useState<ShortcutFolder | null>(null);

  const saveShortcuts = useCallback((nextShortcuts: ShortcutNode[]) => {
    setShortcuts(nextShortcuts);
    void platform.shortcuts.save(nextShortcuts);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const applyShortcuts = (storedShortcuts: ShortcutNode[]) => {
      setShortcuts(storedShortcuts);
    };

    void platform.shortcuts.read().then(
      (storedShortcuts) => {
        if (isCurrent) applyShortcuts(storedShortcuts);
      },
      () => {},
    );

    const unsubscribe = platform.shortcuts.subscribe(applyShortcuts);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source;
    if (!source) return;

    setActiveId(String(source.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    // 无论是否完成排序，拖拽结束后都要关闭浮层预览。
    setActiveId(null);

    const sourceId = event.operation.source?.id;
    const finalTarget = event.operation.target;
    const targetId =
      finalTarget?.type === "merge"
        ? getItemIdFromMergeTarget(finalTarget.id)
        : null;

    if (event.canceled) return;

    if (sourceId && targetId) {
      const nextShortcuts = mergeShortcutIntoNode(
        shortcuts,
        String(sourceId),
        targetId,
        `folder:${crypto.randomUUID()}`,
      );
      if (nextShortcuts !== shortcuts) saveShortcuts(nextShortcuts);
      return;
    }

    const nextShortcuts = move(shortcuts, event);
    if (
      nextShortcuts.some((shortcut, index) => shortcut !== shortcuts[index])
    ) {
      saveShortcuts(nextShortcuts);
    }
  }

  const activeNode = activeId
    ? shortcuts.find((node) => node.id === activeId)
    : undefined;

  return (
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
      onDragEnd={handleDragEnd}
    >
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-20 sm:px-10 sm:pb-8">
        {shortcuts.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <p className="text-lg font-semibold text-white/80">暂无快捷方式</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-6 gap-y-9 pb-10 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))] sm:gap-x-8">
            {shortcuts.map((node, index) => (
              <SortableNode
                key={node.id}
                node={node}
                index={index}
                onOpenFolder={setOpenFolder}
              />
            ))}
          </ul>
        )}
      </section>
      {/* 使用独立浮层展示拖拽项，避免受到列表布局和透明度样式影响。 */}
      <DragOverlay>
        {activeNode ? (
          <div className="rotate-1 scale-105 drop-shadow-2xl">
            <NodePreview node={activeNode} hideTitle />
          </div>
        ) : null}
      </DragOverlay>
      {openFolder ? (
        <FolderDialog folder={openFolder} onClose={() => setOpenFolder(null)} />
      ) : null}
    </DragDropProvider>
  );
}
