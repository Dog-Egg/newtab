import { useEffect, useRef, useState } from "react";
import { platform } from "@platform";
import { CategoryTabs } from "./CategoryTabs";
import {
  DEFAULT_CATEGORY_ID,
  normalizeActiveCategoryId,
  type ShortcutCategory,
  type ShortcutNode,
} from "./launcher";
import { DeleteShortcutCollectionDialog } from "./DeleteShortcutCollectionDialog";
import { ShortcutPage } from "./ShortcutPage";
import { Slider } from "./Slider";
import { useTranslation } from "react-i18next";
import { useSettings } from "../Settings/SettingsProvider";

export function Launcher() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [categories, setCategories] = useState<ShortcutCategory[] | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<ShortcutCategory | null>(null);
  const categoriesRef = useRef<ShortcutCategory[]>([]);

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
      platform.launcher.read(settings.locale),
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

    const unsubscribeCategories = platform.launcher.subscribe(
      settings.locale,
      applyCategories,
    );
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
  }, [settings.locale]);

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
        moveToDefault && category.id === DEFAULT_CATEGORY_ID
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
      selectCategory(DEFAULT_CATEGORY_ID);
    }
    setPendingDeleteCategory(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[15rem] flex-1 overflow-y-auto [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_3rem),transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_3rem),transparent_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>

      <div className="z-20 flex shrink-0 justify-center px-4 pb-10 pt-3 sm:pb-24">
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
                category.id === categoryId ? { ...category, name } : category,
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
          onReorder={saveCategories}
        />
      </div>

      {pendingDeleteCategory ? (
        <DeleteShortcutCollectionDialog
          title={t("launcher.deleteCategoryTitle")}
          collectionName={pendingDeleteCategory.name}
          shortcutCount={pendingDeleteCategory.shortcuts.reduce(
            (count, node) =>
              count + (node.type === "folder" ? node.children.length : 1),
            0,
          )}
          keepShortcutsLabel={t("launcher.keepCategoryShortcuts")}
          deleteAllLabel={t("launcher.deleteCategoryAll")}
          onClose={() => setPendingDeleteCategory(null)}
          onDeleteAll={() => deleteCategory(pendingDeleteCategory.id, false)}
          onKeepShortcuts={() => deleteCategory(pendingDeleteCategory.id, true)}
        />
      ) : null}
    </div>
  );
}
