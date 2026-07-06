import { BOOKMARKS_STORAGE_KEY, type Bookmark, normalizeBookmarks } from './bookmarks';

const MENU_ID = 'save-to-browser-tab';

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '收藏到 BrowserTab',
      contexts: ['page'],
    });
  });
}

function getBookmarks() {
  return new Promise<Bookmark[]>((resolve) => {
    chrome.storage.local.get(BOOKMARKS_STORAGE_KEY, (items) => {
      resolve(normalizeBookmarks(items[BOOKMARKS_STORAGE_KEY]));
    });
  });
}

function setBookmarks(bookmarks: Bookmark[]) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: bookmarks }, resolve);
  });
}

function isWebUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function getFallbackTitle(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function saveBookmark(url: string, title?: string) {
  const bookmarks = await getBookmarks();
  const bookmark: Bookmark = {
    id: url,
    title: title?.trim() || getFallbackTitle(url),
    url,
    createdAt: Date.now(),
  };

  await setBookmarks([bookmark, ...bookmarks.filter((item) => item.url !== url)]);
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

  void saveBookmark(url, tab?.title);
});
