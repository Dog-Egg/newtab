import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DragDropProvider,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import clsx from "clsx";
import { Check, House, Pencil, Plus, Settings2, X } from "lucide-react";
import { DEFAULT_CATEGORY, type ShortcutCategory } from "./launcher";

const CATEGORY_SORTABLE_GROUP = "categories";

function SortableCategory({
  category,
  index,
  isActive,
  isManaging,
  onSelect,
  onRename,
  onDelete,
}: {
  category: ShortcutCategory;
  index: number;
  isActive: boolean;
  isManaging: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const canDelete = category.id !== DEFAULT_CATEGORY.id;
  const showActive = isActive && !isManaging;
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.name);
  const { ref, handleRef, isDragging } = useSortable({
    id: category.id,
    index,
    group: CATEGORY_SORTABLE_GROUP,
  });

  function saveRename() {
    const name = draftName.trim();
    if (name && name !== category.name) onRename(name);
    setDraftName(name || category.name);
    setIsEditing(false);
  }

  useEffect(() => {
    if (!isManaging) {
      setDraftName(category.name);
      setIsEditing(false);
    }
  }, [category.name, isManaging]);

  return (
    <div
      ref={(node) => {
        ref(node);
        handleRef(isEditing ? null : node);
      }}
      className={clsx(
        "group/category flex h-9 shrink-0 cursor-grab touch-none select-none items-center rounded-xl transition duration-200 active:cursor-grabbing",
        showActive
          ? "bg-white/85 text-slate-700 shadow-sm"
          : "text-white/85 hover:bg-white/10 hover:text-white",
        isDragging && "opacity-40",
      )}
    >
      {isEditing ? (
        <input
          autoFocus
          className="placeholder:text-current/50 mx-3 min-w-8 max-w-28 bg-transparent text-xs font-semibold text-inherit outline-none"
          style={{ width: `${draftName.length + 2}ch` }}
          value={draftName}
          maxLength={12}
          aria-label={`修改分类 ${category.name} 的名称`}
          onChange={(event) => setDraftName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={saveRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraftName(category.name);
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="flex h-full items-center gap-1.5 rounded-xl px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-grab"
          aria-current={showActive ? "page" : undefined}
          disabled={isManaging}
          onClick={onSelect}
        >
          {category.id === DEFAULT_CATEGORY.id ? (
            <House className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          ) : null}
          {category.name}
        </button>
      )}
      {isManaging && !isEditing ? (
        <div
          className={clsx(
            "flex max-w-0 shrink-0 items-center gap-0.5 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/category:max-w-12 group-hover/category:opacity-100 group-focus-within/category:max-w-12 group-focus-within/category:opacity-100",
            showActive ? "text-slate-500" : "text-white/70",
          )}
        >
          <button
            type="button"
            className="grid size-5 place-items-center rounded-md outline-none transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-white/80"
            onClick={() => {
              setDraftName(category.name);
              setIsEditing(true);
            }}
            aria-label={`修改分类 ${category.name}`}
            title="修改名称"
          >
            <Pencil className="size-3" strokeWidth={2.2} />
          </button>
          {canDelete ? (
            <button
              type="button"
              className="grid size-5 place-items-center rounded-md outline-none transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-white/80"
              onClick={onDelete}
              aria-label={`删除分类 ${category.name}`}
              title="删除分类"
            >
              <X className="size-3" strokeWidth={2.2} />
            </button>
          ) : null}
          <span className="w-0.5 shrink-0" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}

export function CategoryTabs({
  categories,
  activeCategoryId,
  onAdd,
  onSelect,
  onRename,
  onDelete,
  onReorder,
}: {
  categories: ShortcutCategory[];
  activeCategoryId: string;
  onAdd: (category: ShortcutCategory) => void;
  onSelect: (categoryId: string) => void;
  onRename: (categoryId: string, name: string) => void;
  onDelete: (categoryId: string) => void;
  onReorder: (categories: ShortcutCategory[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startAdding() {
    setDraftName("");
    setIsAdding(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelAdding() {
    setDraftName("");
    setIsAdding(false);
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    const category = {
      id: `category-${Date.now()}`,
      name,
      shortcuts: [],
    };
    onAdd(category);
    cancelAdding();
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = event.operation.source;
    if (event.canceled || !isSortable(source)) return;

    const sourceIndex = categories.findIndex(
      (category) => category.id === source.id,
    );
    if (sourceIndex < 0 || sourceIndex === source.index) return;

    const next = [...categories];
    const [category] = next.splice(sourceIndex, 1);
    if (!category) return;
    next.splice(source.index, 0, category);
    onReorder(next);
  }

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 8 }),
          ],
        }),
      ]}
      onDragEnd={handleDragEnd}
    >
      <nav
        className="flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-[20px] border border-white/25 bg-slate-900/30 p-1.5 shadow-[0_16px_50px_rgba(15,23,42,0.28)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="快捷方式分类"
      >
        {categories.map((category, index) => (
          <SortableCategory
            key={category.id}
            category={category}
            index={index}
            isActive={category.id === activeCategoryId}
            isManaging={isManaging}
            onSelect={() => onSelect(category.id)}
            onRename={(name) => onRename(category.id, name)}
            onDelete={() => onDelete(category.id)}
          />
        ))}

        {isManaging && isAdding ? (
          <form
            className="flex h-9 shrink-0 items-center rounded-xl bg-white/85 pl-3 pr-1"
            onSubmit={addCategory}
          >
            <input
              ref={inputRef}
              className="w-[72px] bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelAdding();
              }}
              placeholder="分类名称"
              maxLength={12}
              aria-label="分类名称"
            />
            <button
              type="submit"
              className="grid size-5 place-items-center rounded-md text-blue-600 transition hover:bg-blue-50 disabled:text-slate-300"
              disabled={!draftName.trim()}
              aria-label="保存分类"
            >
              <Check className="size-3.5" strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="grid size-5 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={cancelAdding}
              aria-label="取消新增分类"
            >
              <X className="size-3.5" />
            </button>
          </form>
        ) : isManaging ? (
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-white/85 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/80"
            onClick={startAdding}
            aria-label="新建分类"
            title="新建分类"
          >
            <Plus className="size-3.5" strokeWidth={2.2} />
          </button>
        ) : null}
        <span
          className="mx-0.5 h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
        <button
          type="button"
          className={clsx(
            "grid size-9 shrink-0 place-items-center rounded-full outline-none transition-all duration-200 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/80",
            isManaging
              ? "bg-white/[0.08] text-white"
              : "text-white/70 hover:text-white",
          )}
          onClick={() => {
            setIsManaging((current) => !current);
            cancelAdding();
          }}
          aria-label={isManaging ? "退出分类管理" : "管理分类"}
          title={isManaging ? "完成管理" : "管理分类"}
        >
          {isManaging ? (
            <X className="size-3.5" strokeWidth={2.2} />
          ) : (
            <Settings2 className="size-3.5" strokeWidth={2.1} />
          )}
        </button>
      </nav>
    </DragDropProvider>
  );
}
