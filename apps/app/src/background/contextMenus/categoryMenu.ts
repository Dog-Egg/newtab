import { DEFAULT_CATEGORY_ID } from "../../Launcher/launcher";
import { getDefaultCategoryNames } from "../../Launcher/defaultLauncher";
import {
  BOOKMARK_LAYOUT_STORAGE_KEY,
  normalizeBookmarkLayout,
  placeBookmarkLayoutItemAtRoot,
  type BookmarkLayoutCategory,
} from "../../Launcher/bookmarkLayout";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
} from "../../Settings/settings";
import { getLocaleFromLanguage, type AppLocale } from "../../i18n/locale";
import { createContextMenuItem } from "./chrome";

const MENU_ID = "save-to-tab";
const CATEGORY_MENU_ID_PREFIX = `${MENU_ID}:category:`;

export const CATEGORY_MENU_STORAGE_KEYS = [
  BOOKMARK_LAYOUT_STORAGE_KEY,
] as const;

export async function createCategoryMenu(
  items: Record<string, unknown>,
  locale: AppLocale,
) {
  const categories = normalizeBookmarkLayout(
    items[BOOKMARK_LAYOUT_STORAGE_KEY],
    getDefaultCategoryNames(locale).home,
  );

  await createContextMenuItem({
    id: MENU_ID,
    title: locale === "zh-CN" ? "添加网站到分类" : "Add Website to Category",
    contexts: ["page"],
  });

  for (const category of categories) {
    await createContextMenuItem({
      id: `${CATEGORY_MENU_ID_PREFIX}${encodeURIComponent(category.id)}`,
      parentId: MENU_ID,
      title: category.name,
      contexts: ["page"],
    });
  }
}

function getCategories() {
  return new Promise<BookmarkLayoutCategory[]>((resolve) => {
    chrome.storage.local.get(
      [SETTINGS_STORAGE_KEY, BOOKMARK_LAYOUT_STORAGE_KEY],
      (items) => {
        const { locale } = normalizeSettings(
          items[SETTINGS_STORAGE_KEY],
          getLocaleFromLanguage(chrome.i18n.getUILanguage()),
        );
        resolve(
          normalizeBookmarkLayout(
            items[BOOKMARK_LAYOUT_STORAGE_KEY],
            getDefaultCategoryNames(locale).home,
          ),
        );
      },
    );
  });
}

function setCategories(categories: BookmarkLayoutCategory[]) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(
      { [BOOKMARK_LAYOUT_STORAGE_KEY]: categories },
      resolve,
    );
  });
}

function isWebUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function getFallbackTitle(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function findOrCreateBookmark(url: string, title: string) {
  return new Promise<chrome.bookmarks.BookmarkTreeNode>((resolve, reject) => {
    chrome.bookmarks.search({ url }, (matches) => {
      const searchError = chrome.runtime.lastError;
      if (searchError) {
        reject(new Error(searchError.message));
        return;
      }

      const existing = matches.find((bookmark) => bookmark.url === url);
      if (existing) {
        resolve(existing);
        return;
      }

      chrome.bookmarks.create({ title, url }, (bookmark) => {
        const createError = chrome.runtime.lastError;
        if (createError) reject(new Error(createError.message));
        else resolve(bookmark);
      });
    });
  });
}

async function saveBookmark(
  url: string,
  title: string | undefined,
  targetCategoryId: string,
) {
  const bookmark = await findOrCreateBookmark(
    url,
    title?.trim() || getFallbackTitle(url),
  );

  // Chrome 创建 bookmark 会产生异步事件；拿到最终 ID 后再读取最新布局，
  // 避免用创建前的旧快照覆盖 Launcher 中刚完成的排序或分类修改。
  const categories = await getCategories();
  const resolvedCategoryId = categories.some(
    (category) => category.id === targetCategoryId,
  )
    ? targetCategoryId
    : DEFAULT_CATEGORY_ID;
  await setCategories(
    placeBookmarkLayoutItemAtRoot(categories, resolvedCategoryId, bookmark.id),
  );
}

// Service worker 内的右键保存按顺序执行，避免连续点击各自读取同一份旧布局。
let saveBookmarkQueue = Promise.resolve();

function enqueueBookmarkSave(
  url: string,
  title: string | undefined,
  categoryId: string,
) {
  saveBookmarkQueue = saveBookmarkQueue.then(
    () => saveBookmark(url, title, categoryId),
    () => saveBookmark(url, title, categoryId),
  );
  return saveBookmarkQueue;
}

export function handleCategoryMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) {
  const menuItemId = String(info.menuItemId);
  if (!menuItemId.startsWith(CATEGORY_MENU_ID_PREFIX)) {
    return false;
  }

  const categoryId = decodeURIComponent(
    menuItemId.slice(CATEGORY_MENU_ID_PREFIX.length),
  );
  const url = tab?.url ?? info.pageUrl;

  if (url && isWebUrl(url)) {
    void enqueueBookmarkSave(url, tab?.title, categoryId).catch(
      (error: unknown) => {
        console.error("Failed to save page as browser bookmark", error);
      },
    );
  }

  return true;
}
