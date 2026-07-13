import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDown, Plus } from "lucide-react";
import { platform } from "@platform";
import type { StoredSearchEngineSettings } from "./platform/types";
import { Dialog, DialogTitle } from "./components/Dialog";
import { SiteIcon } from "./components/SiteIcon";

type SearchEngine = {
  id: string;
  name: string;
  urlFormat: string;
  isCustom?: boolean;
};

const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
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
  {
    id: "baidu",
    name: "百度",
    urlFormat: "https://www.baidu.com/s?wd=%s",
  },
];

const EMPTY_CUSTOM_ENGINE = {
  name: "",
  urlFormat: "",
};

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

  return (
    <SiteIcon
      title={engine.name}
      url={iconSource}
      seed={engine.id}
      format="png"
      className={clsx(
        "rounded-full font-black shadow-sm",
        size === "small" ? "size-6 text-[12px]" : "size-7 text-[12px]",
      )}
    />
  );
}

export function SearchEngineBox() {
  const [storedSettings, setStoredSettings] =
    useState<StoredSearchEngineSettings>({});
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [customEngineDraft, setCustomEngineDraft] =
    useState(EMPTY_CUSTOM_ENGINE);

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
    let isCurrent = true;

    void platform.searchEngineSettings.read().then(
      (settings) => {
        if (!isCurrent) {
          return;
        }

        setStoredSettings(settings);
        setIsSettingsLoaded(true);
      },
      () => {
        if (isCurrent) {
          setIsSettingsLoaded(true);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!isSettingsLoaded) {
      return;
    }

    void platform.searchEngineSettings.save(storedSettings);
  }, [isSettingsLoaded, storedSettings]);

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
    window.setTimeout(() => setIsAddDialogOpen(true), 0);
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
      <div className="relative mx-auto w-full max-w-[526px]" role="search">
        <div className="flex h-12 items-center rounded-2xl border border-white/50 bg-white/75 px-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-md transition focus-within:border-white/80 focus-within:bg-white/85 focus-within:shadow-[0_20px_55px_rgba(15,23,42,0.18)] sm:h-[52px]">
          <Popover.Root open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <Popover.Trigger asChild>
              <button
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-slate-600 outline-none transition hover:bg-slate-900/5 focus-visible:ring-4 focus-visible:ring-blue-300/50"
                type="button"
                aria-label={`选择搜索引擎，当前为${selectedEngine.name}`}
                title={selectedEngine.name}
              >
                <SearchEngineGlyph engine={selectedEngine} size="small" />
                <ChevronDown aria-hidden="true" className="size-4" />
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                className="z-30 w-[calc(100vw-2rem)] max-w-[526px] overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-2 text-slate-700 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
                sideOffset={16}
                align="start"
                alignOffset={-12}
              >
                <div
                  className="flex items-center gap-2 overflow-x-auto p-1"
                  role="group"
                  aria-label="搜索引擎"
                >
                  {searchEngines.map((engine) => (
                    <button
                      key={engine.id}
                      className={clsx(
                        "flex h-16 min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 text-center outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-300/40",
                        engine.id === selectedEngine.id &&
                          "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
                      )}
                      type="button"
                      aria-pressed={engine.id === selectedEngine.id}
                      onClick={() => selectSearchEngine(engine.id)}
                    >
                      <SearchEngineGlyph engine={engine} />
                      <span className="w-full truncate text-xs font-semibold">
                        {engine.name}
                      </span>
                    </button>
                  ))}
                  <button
                    className="flex h-16 min-w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-blue-200 bg-blue-50/70 px-3 text-xs font-semibold text-blue-600 outline-none transition hover:bg-blue-100 focus-visible:bg-blue-100 focus-visible:ring-4 focus-visible:ring-blue-300/40"
                    type="button"
                    onClick={openAddDialog}
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-white text-blue-600 shadow-sm">
                      <Plus aria-hidden="true" className="size-4" />
                    </span>
                    新增
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

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
        <Dialog
          className="max-w-xl rounded-2xl bg-white p-6 text-slate-800 sm:p-8"
          onClose={() => setIsAddDialogOpen(false)}
        >
          {(close) => (
            <form
              onSubmit={(event) => {
                handleAddCustomEngine(event);
                if (canSaveCustomEngine) close();
              }}
              aria-label="新增搜索引擎"
            >
              <DialogTitle className="text-2xl font-semibold">
                新增搜索引擎
              </DialogTitle>

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
                  onClick={close}
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
          )}
        </Dialog>
      ) : null}
    </>
  );
}
