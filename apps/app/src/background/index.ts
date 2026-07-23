import {
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutNode,
} from "../Launcher/launcher";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "../Settings/settings";
import { getLocaleFromLanguage } from "../i18n/locale";
import { normalizeStoredExtensionLauncher } from "../Launcher/defaultLauncher";
import { createRefreshScheduler } from "./contextMenuRefresh";

const MENU_ID = "save-to-tab";
const CATEGORY_MENU_ID_PREFIX = `${MENU_ID}:category:`;
const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

function getLocalStorage(keys: string[]) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items);
    });
  });
}

function removeAllContextMenus() {
  return new Promise<void>((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function createContextMenuItem(
  properties: chrome.contextMenus.CreateProperties,
) {
  return new Promise<void>((resolve, reject) => {
    chrome.contextMenus.create(properties, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function rebuildContextMenu() {
  const items = await getLocalStorage([
    SETTINGS_STORAGE_KEY,
    LAUNCHER_STORAGE_KEY,
  ]);
  const { locale } = normalizeSettings(
    items[SETTINGS_STORAGE_KEY],
    defaultLocale,
  );
  const categories = normalizeStoredExtensionLauncher(
    items[LAUNCHER_STORAGE_KEY],
    locale,
  );

  await removeAllContextMenus();
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

const createContextMenu = createRefreshScheduler(rebuildContextMenu, (error) => {
  console.error("Failed to refresh context menu", error);
});

function getCategories() {
  return new Promise<ShortcutCategory[]>((resolve) => {
    chrome.storage.local.get(
      [SETTINGS_STORAGE_KEY, LAUNCHER_STORAGE_KEY],
      (items) => {
        const { locale } = normalizeSettings(
          items[SETTINGS_STORAGE_KEY],
          defaultLocale,
        );
        resolve(
          normalizeStoredExtensionLauncher(items[LAUNCHER_STORAGE_KEY], locale),
        );
      },
    );
  });
}

function setCategories(categories: ShortcutCategory[]) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ [LAUNCHER_STORAGE_KEY]: categories }, resolve);
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

function removeShortcutUrl(
  shortcuts: ShortcutNode[],
  url: string,
): ShortcutNode[] {
  return shortcuts.flatMap<ShortcutNode>((node) => {
    if (node.type === "item") return node.url === url ? [] : [node];

    const children = node.children.filter((item) => item.url !== url);
    // 删除最后一个子项后也删除空文件夹，避免主页留下无法打开的空壳。
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

async function saveShortcut(
  url: string,
  title: string | undefined,
  targetCategoryId: string,
) {
  const categories = await getCategories();
  const resolvedCategoryId = categories.some(
    (category) => category.id === targetCategoryId,
  )
    ? targetCategoryId
    : DEFAULT_CATEGORY_ID;
  const shortcut: Shortcut = {
    type: "item",
    id: url,
    title: title?.trim() || getFallbackTitle(url),
    url,
    createdAt: Date.now(),
  };

  await setCategories(
    categories.map((category) => ({
      ...category,
      shortcuts:
        category.id === resolvedCategoryId
          ? [shortcut, ...removeShortcutUrl(category.shortcuts, url)]
          : removeShortcutUrl(category.shortcuts, url),
    })),
  );
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    (changes[SETTINGS_STORAGE_KEY] || changes[LAUNCHER_STORAGE_KEY])
  ) {
    createContextMenu();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuItemId = String(info.menuItemId);
  if (!menuItemId.startsWith(CATEGORY_MENU_ID_PREFIX)) {
    return;
  }

  const categoryId = decodeURIComponent(
    menuItemId.slice(CATEGORY_MENU_ID_PREFIX.length),
  );

  const url = tab?.url ?? info.pageUrl;
  if (!url || !isWebUrl(url)) {
    return;
  }

  void saveShortcut(url, tab?.title, categoryId);
});

