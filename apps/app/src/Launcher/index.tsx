import { useEffect, useRef, useState } from "react";
import { platform } from "@platform";
import { CategoryTabs } from "./CategoryTabs";
import type {
  LauncherBookmarkCategory,
  LauncherBookmarkItem,
  LauncherBookmarkNode,
} from "./bookmarkLayout";
import {
  DEFAULT_CATEGORY_ID,
  normalizeActiveCategoryId,
  placeLauncherBookmarkAtRoot,
} from "./bookmarkLayout";
import { DeleteBookmarkCollectionDialog } from "./DeleteBookmarkCollectionDialog";
import { BookmarkPage } from "./BookmarkPage";
import { Slider } from "./Slider";
import { useTranslation } from "react-i18next";
import { useLauncher } from "./LauncherProvider";

export function Launcher() {
  const { t } = useTranslation();
  const { categories, saveCategories } = useLauncher();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<LauncherBookmarkCategory | null>(null);
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

  function persistCategories(nextCategories: LauncherBookmarkCategory[]) {
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

  function updateCategoryBookmarks(
    categoryId: string,
    bookmarks: LauncherBookmarkNode[],
  ) {
    persistCategories(
      categoriesRef.current.map((category) =>
        category.id === categoryId ? { ...category, bookmarks } : category,
      ),
    );
  }

  function addBookmark(categoryId: string, bookmark: LauncherBookmarkItem) {
    // onCreated 可能先把新书签投影到 default；统一放置会先清除所有旧引用。
    persistCategories(
      placeLauncherBookmarkAtRoot(categoriesRef.current, categoryId, bookmark),
    );
  }

  function moveBookmark(
    sourceCategoryId: string,
    sourceBookmarks: LauncherBookmarkNode[],
    bookmark: LauncherBookmarkNode,
    targetCategoryId: string,
  ) {
    persistCategories(
      loadedCategories.map((category) => {
        if (category.id === sourceCategoryId) {
          return { ...category, bookmarks: sourceBookmarks };
        }
        if (category.id === targetCategoryId) {
          return {
            ...category,
            bookmarks: [...category.bookmarks, bookmark],
          };
        }
        return category;
      }),
    );
  }

  function deleteCategory(categoryId: string, moveToDefault: boolean) {
    const currentCategories = categoriesRef.current;
    const deletedCategory = currentCategories.find(
      (category) => category.id === categoryId,
    );
    const nextCategories = currentCategories
      .filter((category) => category.id !== categoryId)
      .map((category) =>
        moveToDefault && category.id === DEFAULT_CATEGORY_ID
          ? {
              ...category,
              bookmarks: [
                ...category.bookmarks,
                ...(deletedCategory?.bookmarks ?? []),
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
          key={JSON.stringify(loadedCategories.map((category) => category.id))}
          items={loadedCategories}
          activeId={activeCategoryId}
          onSelect={selectCategory}
          renderItem={(category) => (
            <BookmarkPage
              categoryId={category.id}
              bookmarks={category.bookmarks}
              categories={loadedCategories}
              onChange={(bookmarks) =>
                updateCategoryBookmarks(category.id, bookmarks)
              }
              onAdd={(bookmark) => addBookmark(category.id, bookmark)}
              onMove={(sourceBookmarks, bookmark, targetCategoryId) =>
                moveBookmark(
                  category.id,
                  sourceBookmarks,
                  bookmark,
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
            const hasBookmarks = category.bookmarks.length > 0;
            if (hasBookmarks) {
              setPendingDeleteCategory(category);
            } else {
              deleteCategory(categoryId, false);
            }
          }}
          onReorder={persistCategories}
        />
      </div>

      {pendingDeleteCategory ? (
        <DeleteBookmarkCollectionDialog
          title={t("launcher.deleteCategoryTitle")}
          collectionName={pendingDeleteCategory.name}
          bookmarkCount={pendingDeleteCategory.bookmarks.reduce(
            (count, node) =>
              count + (node.type === "folder" ? node.children.length : 1),
            0,
          )}
          keepBookmarksLabel={t("launcher.keepCategoryBookmarks")}
          deleteAllLabel={t("launcher.deleteCategoryAll")}
          onClose={() => setPendingDeleteCategory(null)}
          onDeleteAll={() => {
            const ids = pendingDeleteCategory.bookmarks.flatMap((node) =>
              node.type === "folder"
                ? node.children.map((child) => child.id)
                : [node.id],
            );
            const categoryId = pendingDeleteCategory.id;
            // 等 Chrome 完成后再删除布局。失败的实体仍存在，会按规则回到 default 根部。
            void Promise.allSettled(
              ids.map((id) => platform.bookmarks.remove(id)),
            ).then((results) => {
              const errors = results.flatMap((result) =>
                result.status === "rejected" ? [result.reason] : [],
              );
              if (errors.length > 0) {
                console.error(
                  "Failed to remove some category bookmarks",
                  errors,
                );
              }
              deleteCategory(categoryId, false);
            });
          }}
          onKeepBookmarks={() => deleteCategory(pendingDeleteCategory.id, true)}
        />
      ) : null}
    </div>
  );
}
