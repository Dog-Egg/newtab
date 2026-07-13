import {
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY,
  normalizeLauncher,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutNode,
} from "./Launcher/launcher";

const MENU_ID = "save-to-browser-tab";

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "添加快捷方式到 BrowserTab",
      contexts: ["page"],
    });
  });
}

function getCategories() {
  return new Promise<ShortcutCategory[]>((resolve) => {
    chrome.storage.local.get(LAUNCHER_STORAGE_KEY, (items) => {
      resolve(normalizeLauncher(items[LAUNCHER_STORAGE_KEY]));
    });
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
    // 删除最后一个子项后也删除空文件夹，避免首页留下无法打开的空壳。
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

async function saveShortcut(url: string, title?: string) {
  const categories = await getCategories();
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
        category.id === DEFAULT_CATEGORY.id
          ? [shortcut, ...removeShortcutUrl(category.shortcuts, url)]
          : removeShortcutUrl(category.shortcuts, url),
    })),
  );
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const url = tab?.url ?? info.pageUrl;
  if (!url || !isWebUrl(url)) {
    return;
  }

  void saveShortcut(url, tab?.title);
});
