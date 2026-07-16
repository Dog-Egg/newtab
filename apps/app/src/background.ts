import {
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY_ID,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutNode,
} from "./Launcher/launcher";
import { normalizeSettings, SETTINGS_STORAGE_KEY } from "./Settings/settings";
import { getLocaleFromLanguage } from "./i18n/locale";
import { normalizeStoredLauncher } from "./Launcher/defaultLauncher";

const MENU_ID = "save-to-tab";
const CATEGORY_MENU_ID_PREFIX = `${MENU_ID}:category:`;
const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

function createContextMenu() {
  chrome.storage.local.get(
    [SETTINGS_STORAGE_KEY, LAUNCHER_STORAGE_KEY],
    (items) => {
      const { locale } = normalizeSettings(
        items[SETTINGS_STORAGE_KEY],
        defaultLocale,
      );
      const categories = normalizeStoredLauncher(
        items[LAUNCHER_STORAGE_KEY],
        locale,
      );

      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: MENU_ID,
          title:
            locale === "zh-CN" ? "添加网站到分类" : "Add Website to Category",
          contexts: ["page"],
        });

        for (const category of categories) {
          chrome.contextMenus.create({
            id: `${CATEGORY_MENU_ID_PREFIX}${encodeURIComponent(category.id)}`,
            parentId: MENU_ID,
            title: category.name,
            contexts: ["page"],
          });
        }
      });
    },
  );
}

function getCategories() {
  return new Promise<ShortcutCategory[]>((resolve) => {
    chrome.storage.local.get(
      [SETTINGS_STORAGE_KEY, LAUNCHER_STORAGE_KEY],
      (items) => {
        const { locale } = normalizeSettings(
          items[SETTINGS_STORAGE_KEY],
          defaultLocale,
        );
        resolve(normalizeStoredLauncher(items[LAUNCHER_STORAGE_KEY], locale));
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
