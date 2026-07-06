import { BOOKMARKS_STORAGE_KEY, type Bookmark, type BookmarkNode, normalizeBookmarks } from './bookmarks';

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
  return new Promise<BookmarkNode[]>((resolve) => {
    chrome.storage.local.get(BOOKMARKS_STORAGE_KEY, (items) => {
      resolve(normalizeBookmarks(items[BOOKMARKS_STORAGE_KEY]));
    });
  });
}

function setBookmarks(bookmarks: BookmarkNode[]) {
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

function removeBookmarkUrl(bookmarks: BookmarkNode[], url: string): BookmarkNode[] {
  return bookmarks.flatMap((item): BookmarkNode[] => {
    if (item.type === 'bookmark') {
      return item.url === url ? [] : [item];
    }

    return [
      {
        ...item,
        children: item.children.filter((child) => child.url !== url),
      },
    ];
  });
}

async function saveBookmark(url: string, title?: string) {
  const bookmarks = await getBookmarks();
  const bookmark: Bookmark = {
    type: 'bookmark',
    id: url,
    title: title?.trim() || getFallbackTitle(url),
    url,
    createdAt: Date.now(),
  };

  await setBookmarks([bookmark, ...removeBookmarkUrl(bookmarks, url)]);
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
