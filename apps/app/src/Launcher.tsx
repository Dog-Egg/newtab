import { useCallback, useEffect, useState } from "react";
import {
  DragDropProvider,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { type SortableDraggable } from "@dnd-kit/dom/sortable";
import { move } from "@dnd-kit/helpers";
import { useSortable } from "@dnd-kit/react/sortable";
import clsx from "clsx";
import { platform } from "@platform";
import { type ShortcutItem } from "./shortcuts";
import { SiteIcon } from "./components/SiteIcon";

type SortableCollisionDetector = NonNullable<
  Parameters<typeof useSortable>[0]["collisionDetector"]
>;

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

function SortableShortcut({
  shortcut,
  index,
}: {
  shortcut: ShortcutItem;
  index: number;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: shortcut.id,
    index,
    collisionDetector: reorderCollisionDetector,
  });

  return (
    <li
      ref={ref}
      className={clsx("will-change-transform", isDragging && "opacity-30")}
    >
      <a
        ref={handleRef}
        className="flex w-full touch-none select-none justify-center rounded-[30px] px-1 py-2 outline-none transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-white/70"
        href={shortcut.url}
        target={import.meta.env.MODE === "web" ? "_parent" : undefined}
        rel={import.meta.env.MODE === "web" ? "noreferrer" : undefined}
      >
        <ShortcutPreview shortcut={shortcut} hideTitle={isDragging} />
      </a>
    </li>
  );
}

export function Launcher() {
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  // 记录当前拖拽项，用于渲染跟随指针的浮层预览。
  const [activeId, setActiveId] = useState<string | null>(null);

  const saveShortcuts = useCallback((nextShortcuts: ShortcutItem[]) => {
    setShortcuts(nextShortcuts);
    void platform.shortcuts.save(nextShortcuts);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const applyShortcuts = (storedShortcuts: ShortcutItem[]) => {
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
    if (event.canceled) return;

    const nextShortcuts = move(shortcuts, event);
    if (
      nextShortcuts.some((shortcut, index) => shortcut !== shortcuts[index])
    ) {
      saveShortcuts(nextShortcuts);
    }
  }

  const activeShortcut = activeId
    ? shortcuts.find((shortcut) => shortcut.id === activeId)
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
            {shortcuts.map((shortcut, index) => (
              <SortableShortcut
                key={shortcut.id}
                shortcut={shortcut}
                index={index}
              />
            ))}
          </ul>
        )}
      </section>
      {/* 使用独立浮层展示拖拽项，避免受到列表布局和透明度样式影响。 */}
      <DragOverlay>
        {activeShortcut ? (
          <div className="rotate-1 scale-105 drop-shadow-2xl">
            <ShortcutPreview shortcut={activeShortcut} hideTitle />
          </div>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
}
