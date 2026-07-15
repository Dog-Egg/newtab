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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          ? "bg-glass-selected text-glass-selected-content shadow-sm"
          : "text-glass-content hover:bg-glass-hover hover:text-glass-strong",
        isDragging && "opacity-40",
      )}
    >
      {isEditing ? (
        <input
          autoFocus
          className="placeholder:text-current/50 mx-3 min-w-8 max-w-28 bg-transparent text-control text-inherit outline-none"
          style={{ width: `${draftName.length + 2}ch` }}
          value={draftName}
          maxLength={12}
          aria-label={t("launcher.renameCategory", { name: category.name })}
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
          className="flex h-full items-center gap-1.5 rounded-xl px-3 text-control outline-none focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-grab"
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
            "flex max-w-0 shrink-0 items-center gap-0.5 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-out group-focus-within/category:max-w-12 group-focus-within/category:opacity-100 group-hover/category:max-w-12 group-hover/category:opacity-100",
            showActive ? "text-slate-500" : "text-white/70",
          )}
        >
          <button
            type="button"
            className="grid size-5 place-items-center rounded-md outline-none transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-glass-focus"
            onClick={() => {
              setDraftName(category.name);
              setIsEditing(true);
            }}
            aria-label={t("launcher.editCategory", { name: category.name })}
            title={t("launcher.rename")}
          >
            <Pencil className="size-3" strokeWidth={2.2} />
          </button>
          {canDelete ? (
            <button
              type="button"
              className="grid size-5 place-items-center rounded-md outline-none transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-glass-focus"
              onClick={onDelete}
              aria-label={t("launcher.deleteCategory", { name: category.name })}
              title={t("launcher.deleteCategoryTitle")}
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
  const { t } = useTranslation();
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
        className="glass-panel flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={t("launcher.categories")}
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
            className="flex h-9 shrink-0 items-center rounded-xl bg-glass-selected pl-3 pr-1"
            onSubmit={addCategory}
          >
            <input
              ref={inputRef}
              className="w-[72px] bg-transparent text-control text-glass-selected-content outline-none placeholder:text-glass-muted"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelAdding();
              }}
              placeholder={t("launcher.categoryName")}
              maxLength={12}
              aria-label={t("launcher.categoryName")}
            />
            <button
              type="submit"
              className="grid size-5 place-items-center rounded-md text-action transition hover:bg-blue-50 disabled:text-slate-300"
              disabled={!draftName.trim()}
              aria-label={t("launcher.saveCategory")}
            >
              <Check className="size-3.5" strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="grid size-5 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={cancelAdding}
              aria-label={t("launcher.cancelNewCategory")}
            >
              <X className="size-3.5" />
            </button>
          </form>
        ) : isManaging ? (
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus"
            onClick={startAdding}
            aria-label={t("launcher.newCategory")}
            title={t("launcher.newCategory")}
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
            "grid size-9 shrink-0 place-items-center rounded-full outline-none transition-all duration-200 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-glass-focus",
            isManaging
              ? "bg-white/[0.08] text-white"
              : "text-white/70 hover:text-white",
          )}
          onClick={() => {
            setIsManaging((current) => !current);
            cancelAdding();
          }}
          aria-label={t(
            isManaging
              ? "launcher.exitManagement"
              : "launcher.manageCategories",
          )}
          title={t(
            isManaging
              ? "launcher.finishManagement"
              : "launcher.manageCategories",
          )}
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
