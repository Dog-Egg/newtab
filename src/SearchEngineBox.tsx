import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import {
  getSiteIconBackground,
  getSiteIconImageUrl,
  getSiteIconText,
  loadedSiteIconImageUrls,
} from "./siteIcons";

type SearchEngine = {
  id: string;
  name: string;
  urlFormat: string;
  isCustom?: boolean;
};

type StoredSearchEngineSettings = {
  selectedEngineId?: string;
  customEngines?: Array<{
    id: string;
    name: string;
    urlFormat: string;
  }>;
};

const SEARCH_ENGINE_SETTINGS_KEY = "browser-tab.searchEngineSettings.v1";

const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "baidu",
    name: "百度",
    urlFormat: "https://www.baidu.com/s?wd=%s",
  },
  {
    id: "google",
    name: "Google",
    urlFormat: "https://www.google.com/search?q=%s",
  },
  {
    id: "bing",
    name: "Bing",
    urlFormat: "https://www.bing.com/search?q=%s",
  },
  {
    id: "sogou",
    name: "搜狗",
    urlFormat: "https://www.sogou.com/web?query=%s",
  },
];

const EMPTY_CUSTOM_ENGINE = {
  name: "",
  urlFormat: "",
};

function readStoredSettings(): StoredSearchEngineSettings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawSettings = window.localStorage.getItem(SEARCH_ENGINE_SETTINGS_KEY);
    if (!rawSettings) {
      return {};
    }

    const parsedSettings = JSON.parse(rawSettings);
    if (!parsedSettings || typeof parsedSettings !== "object") {
      return {};
    }

    return parsedSettings as StoredSearchEngineSettings;
  } catch {
    return {};
  }
}

function saveStoredSettings(settings: StoredSearchEngineSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SEARCH_ENGINE_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function normalizeCustomEngines(
  customEngines: StoredSearchEngineSettings["customEngines"],
): SearchEngine[] {
  if (!Array.isArray(customEngines)) {
    return [];
  }

  return customEngines.flatMap((engine) => {
    const name = engine.name?.trim();
    const urlFormat = engine.urlFormat?.trim();

    if (!engine.id || !name || !urlFormat) {
      return [];
    }

    return [
      {
        id: engine.id,
        name,
        urlFormat,
        isCustom: true,
      },
    ];
  });
}

function buildSearchUrl(urlFormat: string, query: string) {
  const encodedQuery = encodeURIComponent(query);

  if (urlFormat.includes("%s")) {
    return urlFormat.split("%s").join(encodedQuery);
  }

  const separator = urlFormat.includes("?") ? "&" : "?";
  return `${urlFormat}${separator}q=${encodedQuery}`;
}

function createCustomEngineId() {
  return `custom-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getSearchEngineIconSource(urlFormat: string) {
  return urlFormat.split("%s").join("");
}

function SearchEngineGlyph({
  engine,
  size = "normal",
}: {
  engine: SearchEngine;
  size?: "normal" | "small";
}) {
  const iconSource = getSearchEngineIconSource(engine.urlFormat);
  const imageUrl = getSiteIconImageUrl(iconSource);
  const [isImageLoaded, setIsImageLoaded] = useState(() =>
    Boolean(imageUrl && loadedSiteIconImageUrls.has(imageUrl)),
  );

  useEffect(() => {
    setIsImageLoaded(Boolean(imageUrl && loadedSiteIconImageUrls.has(imageUrl)));
  }, [imageUrl]);

  return (
    <span
      className={clsx(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-black text-white shadow-sm",
        size === "small" ? "size-6 text-[12px]" : "size-7 text-[12px]",
      )}
      style={{ background: getSiteIconBackground(engine.id) }}
    >
      {getSiteIconText({ title: engine.name, url: iconSource })}
      {imageUrl ? (
        <img
          alt=""
          className={clsx(
            "absolute inset-0 size-full object-cover",
            isImageLoaded ? "opacity-100" : "opacity-0",
          )}
          src={imageUrl}
          onLoad={() => {
            loadedSiteIconImageUrls.add(imageUrl);
            setIsImageLoaded(true);
          }}
          onError={() => {
            loadedSiteIconImageUrls.delete(imageUrl);
            setIsImageLoaded(false);
          }}
        />
      ) : null}
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function SearchEngineBox() {
  const [storedSettings, setStoredSettings] = useState(readStoredSettings);
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [customEngineDraft, setCustomEngineDraft] =
    useState(EMPTY_CUSTOM_ENGINE);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const customEngines = useMemo(
    () => normalizeCustomEngines(storedSettings.customEngines),
    [storedSettings.customEngines],
  );
  const searchEngines = useMemo(
    () => [...DEFAULT_SEARCH_ENGINES, ...customEngines],
    [customEngines],
  );
  const selectedEngine =
    searchEngines.find(
      (engine) => engine.id === storedSettings.selectedEngineId,
    ) ?? searchEngines[0];
  const canSaveCustomEngine =
    customEngineDraft.name.trim() && customEngineDraft.urlFormat.trim();

  useEffect(() => {
    saveStoredSettings(storedSettings);
  }, [storedSettings]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setIsAddDialogOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectSearchEngine(engineId: string) {
    setStoredSettings((currentSettings) => ({
      ...currentSettings,
      selectedEngineId: engineId,
    }));
    setIsDropdownOpen(false);
  }

  function openAddDialog() {
    setCustomEngineDraft(EMPTY_CUSTOM_ENGINE);
    setIsDropdownOpen(false);
    setIsAddDialogOpen(true);
  }

  function handleAddCustomEngine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = customEngineDraft.name.trim();
    const urlFormat = customEngineDraft.urlFormat.trim();
    if (!name || !urlFormat) {
      return;
    }

    const nextCustomEngine = {
      id: createCustomEngineId(),
      name,
      urlFormat,
    };

    setStoredSettings((currentSettings) => ({
      ...currentSettings,
      selectedEngineId: nextCustomEngine.id,
      customEngines: [
        ...(currentSettings.customEngines ?? []),
        nextCustomEngine,
      ],
    }));
    setIsAddDialogOpen(false);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    window.location.assign(
      buildSearchUrl(selectedEngine.urlFormat, trimmedQuery),
    );
  }

  return (
    <>
      <div
        className="relative mx-auto w-full max-w-[526px]"
        ref={dropdownRef}
        role="search"
      >
        <div className="flex h-12 items-center rounded-2xl border border-white/50 bg-white/75 px-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-md transition focus-within:border-white/80 focus-within:bg-white/85 focus-within:shadow-[0_20px_55px_rgba(15,23,42,0.18)] sm:h-[52px]">
          <button
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-slate-600 outline-none transition hover:bg-slate-900/5 focus-visible:ring-4 focus-visible:ring-blue-300/50"
            type="button"
            onClick={() => setIsDropdownOpen((isOpen) => !isOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label={`选择搜索引擎，当前为${selectedEngine.name}`}
            title={selectedEngine.name}
          >
            <SearchEngineGlyph engine={selectedEngine} size="small" />
            <ChevronDownIcon />
          </button>

          {isDropdownOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-2 text-slate-700 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl">
              <div
                className="flex items-center gap-2 overflow-x-auto p-1"
                role="listbox"
              >
                {searchEngines.map((engine) => (
                  <button
                    key={engine.id}
                    className={clsx(
                      "flex h-16 min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 text-center transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none",
                      engine.id === selectedEngine.id &&
                        "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
                    )}
                    type="button"
                    role="option"
                    aria-selected={engine.id === selectedEngine.id}
                    onClick={() => selectSearchEngine(engine.id)}
                  >
                    <SearchEngineGlyph engine={engine} />
                    <span className="w-full truncate text-xs font-semibold">
                      {engine.name}
                    </span>
                  </button>
                ))}
                <button
                  className="flex h-16 min-w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-blue-200 bg-blue-50/70 px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40"
                  type="button"
                  onClick={openAddDialog}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-white text-blue-600 shadow-sm">
                    <PlusIcon />
                  </span>
                  新增
                </button>
              </div>
            </div>
          ) : null}

          <div className="mx-1 h-6 w-px shrink-0 bg-slate-900/10" />

          <form className="flex min-w-0 flex-1" onSubmit={handleSearchSubmit}>
            <input
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] font-semibold text-slate-700 outline-none placeholder:text-slate-400 sm:text-base"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入搜索内容"
              aria-label="输入搜索内容"
            />
          </form>
        </div>
      </div>

      {isAddDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 backdrop-blur-sm">
          <form
            className="w-full max-w-xl rounded-2xl bg-white p-6 text-slate-800 shadow-2xl sm:p-8"
            onSubmit={handleAddCustomEngine}
            aria-label="新增搜索引擎"
          >
            <h2 className="text-2xl font-semibold">新增搜索引擎</h2>

            <label className="mt-7 block text-sm font-semibold text-slate-600">
              名称
              <input
                className="mt-2 h-14 w-full rounded-xl border-0 bg-slate-100 px-4 text-lg font-semibold text-slate-800 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-blue-300"
                value={customEngineDraft.name}
                onChange={(event) =>
                  setCustomEngineDraft((draft) => ({
                    ...draft,
                    name: event.target.value,
                  }))
                }
                placeholder="搜狗"
              />
            </label>

            <label className="mt-5 block text-sm font-semibold text-slate-600">
              网址格式（用“%s”代替搜索字词）
              <input
                className="mt-2 h-14 w-full rounded-xl border-0 bg-slate-100 px-4 text-base font-semibold text-slate-800 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-blue-300"
                value={customEngineDraft.urlFormat}
                onChange={(event) =>
                  setCustomEngineDraft((draft) => ({
                    ...draft,
                    urlFormat: event.target.value,
                  }))
                }
                placeholder="https://www.sogou.com/web?query=%s"
              />
            </label>

            <div className="mt-8 flex justify-end gap-3">
              <button
                className="h-12 rounded-full border border-blue-200 px-8 text-base font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40"
                type="button"
                onClick={() => setIsAddDialogOpen(false)}
              >
                取消
              </button>
              <button
                className="h-12 rounded-full bg-blue-600 px-9 text-base font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/50 disabled:cursor-not-allowed disabled:bg-blue-300"
                type="submit"
                disabled={!canSaveCustomEngine}
              >
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
