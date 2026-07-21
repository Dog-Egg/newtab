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
import { useLauncher } from "./LauncherProvider";

export function Launcher() {
  const { t } = useTranslation();
  const { categories, saveCategories } = useLauncher();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<ShortcutCategory | null>(null);
  const categoriesRef = useRef(categories);

  useEffect(() => {
    categoriesRef.current = categories;
    setActiveCategoryId((current) =>
      current === null ? null : normalizeActiveCategoryId(current, categories),
    );
  }, [categories]);

  useEffect(() => {
    let isCurrent = true;
    let receivedSubscriptionUpdate = false;
    const unsubscribeActiveCategory = platform.activeCategoryId.subscribe(
      (categoryId) => {
        receivedSubscriptionUpdate = true;
        setActiveCategoryId(
          normalizeActiveCategoryId(categoryId, categoriesRef.current),
        );
      },
    );

    void platform.activeCategoryId.read().then(
      (storedActiveCategoryId) => {
        if (!isCurrent || receivedSubscriptionUpdate) return;
        setActiveCategoryId(
          normalizeActiveCategoryId(
            storedActiveCategoryId,
            categoriesRef.current,
          ),
        );
      },
      () => {
        if (!isCurrent || receivedSubscriptionUpdate) return;
        setActiveCategoryId(DEFAULT_CATEGORY_ID);
      },
    );

    return () => {
      isCurrent = false;
      unsubscribeActiveCategory();
    };
  }, []);

  // Only the launcher waits for its persisted selection. The rest of App can
  // render immediately, while this avoids flashing the default category first.
  if (activeCategoryId === null) return null;

  const loadedCategories = categories;

  function persistCategories(nextCategories: ShortcutCategory[]) {
    // Keep subscription validation in sync immediately. Storage callbacks can
    // arrive before the categories effect runs after adding or deleting a tab.
    categoriesRef.current = nextCategories;
    saveCategories(nextCategories);
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
    persistCategories(
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
    persistCategories(
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
    persistCategories(nextCategories);
    if (activeCategoryId === categoryId) {
      selectCategory(DEFAULT_CATEGORY_ID);
    }
    setPendingDeleteCategory(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[15rem] flex-1 overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_3rem),transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_2rem,black_calc(100%_-_3rem),transparent_100%)]">
        <Slider
          // Embla keeps its selected index while its slide list changes. Remount
          // for structural changes so a newly active category opens its own page.
          key={JSON.stringify(
            loadedCategories.map((category) => category.id),
          )}
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
            persistCategories([...loadedCategories, category]);
            selectCategory(category.id);
          }}
          onRename={(categoryId, name) =>
            persistCategories(
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
          onReorder={persistCategories}
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
