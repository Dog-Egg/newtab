import { useEffect, useRef, useState } from "react";
import { platform } from "@platform";
import { CategoryTabs } from "./CategoryTabs";
import {
  DEFAULT_CATEGORY,
  normalizeActiveCategoryId,
  type ShortcutCategory,
  type ShortcutNode,
} from "./launcher";
import { Dialog, DialogTitle } from "../components/Dialog";
import { ShortcutPage } from "./ShortcutPage";
import { useLauncherSettings } from "./launcherSettings";
import { Slider } from "./Slider";

function DeleteCategoryDialog({
  category,
  shortcutCount,
  onClose,
  onDeleteAll,
  onMoveToDefault,
}: {
  category: ShortcutCategory;
  shortcutCount: number;
  onClose: () => void;
  onDeleteAll: () => void;
  onMoveToDefault: () => void;
}) {
  return (
    <Dialog
      onClose={onClose}
      className="max-w-md rounded-[28px] border-white/20 bg-slate-900/90 p-7 backdrop-blur-2xl"
    >
      {(close) => (
        <>
          <DialogTitle className="text-xl font-bold">删除分类</DialogTitle>
          <p className="mt-3 text-sm leading-6 text-white/70">
            “{category.name}”中有 {shortcutCount} 个快捷方式。你希望如何处理？
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              onClick={() => {
                onMoveToDefault();
                close();
              }}
            >
              仅删除分类，快捷方式移到首页
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-500/15 px-4 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-red-500/25"
              onClick={() => {
                onDeleteAll();
                close();
              }}
            >
              删除分类及其中的所有快捷方式
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={close}
            >
              取消
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function Launcher() {
  const { nodeScale } = useLauncherSettings();
  const [categories, setCategories] = useState<ShortcutCategory[] | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORY.id);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<ShortcutCategory | null>(null);
  const categoriesRef = useRef<ShortcutCategory[]>([DEFAULT_CATEGORY]);

  useEffect(() => {
    let isCurrent = true;
    const applyCategories = (storedCategories: ShortcutCategory[]) => {
      categoriesRef.current = storedCategories;
      setCategories(storedCategories);
      setActiveCategoryId((current) =>
        normalizeActiveCategoryId(current, storedCategories),
      );
    };

    void Promise.all([
      platform.launcher.read(),
      platform.activeCategoryId.read(),
    ]).then(
      ([storedCategories, storedActiveCategoryId]) => {
        if (!isCurrent) return;
        applyCategories(storedCategories);
        setActiveCategoryId(
          normalizeActiveCategoryId(storedActiveCategoryId, storedCategories),
        );
      },
      () => {},
    );

    const unsubscribeCategories = platform.launcher.subscribe(applyCategories);
    const unsubscribeActiveCategory = platform.activeCategoryId.subscribe(
      (categoryId) =>
        setActiveCategoryId(
          normalizeActiveCategoryId(categoryId, categoriesRef.current),
        ),
    );
    return () => {
      isCurrent = false;
      unsubscribeCategories();
      unsubscribeActiveCategory();
    };
  }, []);

  if (!categories) return null;
  const loadedCategories = categories;

  function saveCategories(nextCategories: ShortcutCategory[]) {
    categoriesRef.current = nextCategories;
    setCategories(nextCategories);
    void platform.launcher.save(nextCategories);
  }

  function selectCategory(categoryId: string) {
    if (categoryId === activeCategoryId) return;
    setActiveCategoryId(categoryId);
    void platform.activeCategoryId.save(categoryId);
  }

  function updateCategoryShortcuts(
    categoryId: string,
    shortcuts: ShortcutNode[],
  ) {
    saveCategories(
      loadedCategories.map((category) =>
        category.id === categoryId ? { ...category, shortcuts } : category,
      ),
    );
  }

  function moveShortcut(
    sourceCategoryId: string,
    sourceShortcuts: ShortcutNode[],
    shortcut: ShortcutNode,
    targetCategoryId: string,
  ) {
    saveCategories(
      loadedCategories.map((category) => {
        if (category.id === sourceCategoryId) {
          return { ...category, shortcuts: sourceShortcuts };
        }
        if (category.id === targetCategoryId) {
          return { ...category, shortcuts: [...category.shortcuts, shortcut] };
        }
        return category;
      }),
    );
  }

  function deleteCategory(categoryId: string, moveToDefault: boolean) {
    const deletedCategory = loadedCategories.find(
      (category) => category.id === categoryId,
    );
    const nextCategories = loadedCategories
      .filter((category) => category.id !== categoryId)
      .map((category) =>
        moveToDefault && category.id === DEFAULT_CATEGORY.id
          ? {
              ...category,
              shortcuts: [
                ...category.shortcuts,
                ...(deletedCategory?.shortcuts ?? []),
              ],
            }
          : category,
      );
    saveCategories(nextCategories);
    if (activeCategoryId === categoryId) {
      selectCategory(DEFAULT_CATEGORY.id);
    }
    setPendingDeleteCategory(null);
  }

  return (
    <>
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col overflow-hidden px-6 pt-12 sm:px-10 sm:pt-14">
        <div
          className="grid justify-center gap-x-3 sm:gap-x-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, ${Math.round(88 * nodeScale)}px)`,
          }}
        >
          <div className="col-span-full justify-self-start">
            <CategoryTabs
              categories={loadedCategories}
              activeCategoryId={activeCategoryId}
              onSelect={selectCategory}
              onAdd={(category) => {
                saveCategories([...loadedCategories, category]);
                selectCategory(category.id);
              }}
              onRename={(categoryId, name) =>
                saveCategories(
                  loadedCategories.map((category) =>
                    category.id === categoryId
                      ? { ...category, name }
                      : category,
                  ),
                )
              }
              onDelete={(categoryId) => {
                const category = loadedCategories.find(
                  (candidate) => candidate.id === categoryId,
                );
                if (!category) return;
                const hasShortcuts = category.shortcuts.length > 0;
                if (hasShortcuts) {
                  setPendingDeleteCategory(category);
                } else {
                  deleteCategory(categoryId, false);
                }
              }}
              onReorder={(nextCategories) => saveCategories(nextCategories)}
            />
          </div>
        </div>
      </section>

      <Slider
        items={loadedCategories}
        activeId={activeCategoryId}
        onSelect={selectCategory}
        renderItem={(category) => (
          <ShortcutPage
            categoryId={category.id}
            shortcuts={category.shortcuts}
            categories={loadedCategories}
            onChange={(shortcuts) =>
              updateCategoryShortcuts(category.id, shortcuts)
            }
            onMove={(sourceShortcuts, shortcut, targetCategoryId) =>
              moveShortcut(
                category.id,
                sourceShortcuts,
                shortcut,
                targetCategoryId,
              )
            }
          />
        )}
      />

      {pendingDeleteCategory ? (
        <DeleteCategoryDialog
          category={pendingDeleteCategory}
          shortcutCount={pendingDeleteCategory.shortcuts.reduce(
            (count, node) =>
              count + (node.type === "folder" ? node.children.length : 1),
            0,
          )}
          onClose={() => setPendingDeleteCategory(null)}
          onDeleteAll={() => deleteCategory(pendingDeleteCategory.id, false)}
          onMoveToDefault={() => deleteCategory(pendingDeleteCategory.id, true)}
        />
      ) : null}
    </>
  );
}
