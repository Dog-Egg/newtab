import { useEffect, useState } from 'react';
import { BOOKMARKS_STORAGE_KEY, type Bookmark, normalizeBookmarks } from './bookmarks';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof chrome === 'undefined') {
      setIsLoading(false);
      return;
    }

    chrome.storage.local.get(BOOKMARKS_STORAGE_KEY, (items) => {
      setBookmarks(normalizeBookmarks(items[BOOKMARKS_STORAGE_KEY]));
      setIsLoading(false);
    });

    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== 'local' || !changes[BOOKMARKS_STORAGE_KEY]) {
        return;
      }

      setBookmarks(normalizeBookmarks(changes[BOOKMARKS_STORAGE_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return (
    <main className="min-h-screen min-w-80 bg-zinc-50 font-sans text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">BrowserTab</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">收藏夹</h1>
          </div>
          <p className="text-sm text-zinc-500">{bookmarks.length} 个收藏</p>
        </header>

        {isLoading ? (
          <div className="grid flex-1 place-items-center text-zinc-500">正在加载...</div>
        ) : bookmarks.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            <p className="text-lg font-medium text-zinc-500">暂无收藏</p>
          </div>
        ) : (
          <ul className="grid gap-3 py-6">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <a
                  className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
                  href={bookmark.url}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-zinc-950">{bookmark.title}</h2>
                      <p className="mt-1 truncate text-sm text-zinc-500">{bookmark.url}</p>
                    </div>
                    <time className="shrink-0 text-sm text-zinc-400" dateTime={new Date(bookmark.createdAt).toISOString()}>
                      {dateFormatter.format(bookmark.createdAt)}
                    </time>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
