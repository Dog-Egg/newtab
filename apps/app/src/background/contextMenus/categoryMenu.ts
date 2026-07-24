import {
  DEFAULT_CATEGORY_ID,
  LAUNCHER_STORAGE_KEY,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutNode,
} from "../../Launcher/launcher";
import { normalizeStoredExtensionLauncher } from "../../Launcher/defaultLauncher";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
} from "../../Settings/settings";
import { getLocaleFromLanguage, type AppLocale } from "../../i18n/locale";
import { createContextMenuItem } from "./chrome";

const MENU_ID = "save-to-tab";
const CATEGORY_MENU_ID_PREFIX = `${MENU_ID}:category:`;

export const CATEGORY_MENU_STORAGE_KEYS = [LAUNCHER_STORAGE_KEY] as const;

export async function createCategoryMenu(
  items: Record<string, unknown>,
  locale: AppLocale,
) {
  const categories = normalizeStoredExtensionLauncher(
    items[LAUNCHER_STORAGE_KEY],
    locale,
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
  return new Promise<ShortcutCategory[]>((resolve) => {
    chrome.storage.local.get(
      [SETTINGS_STORAGE_KEY, LAUNCHER_STORAGE_KEY],
      (items) => {
        const { locale } = normalizeSettings(
          items[SETTINGS_STORAGE_KEY],
          getLocaleFromLanguage(chrome.i18n.getUILanguage()),
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
    void saveShortcut(url, tab?.title, categoryId);
  }

  return true;
}
