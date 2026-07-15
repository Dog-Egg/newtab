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
      },
      () => undefined,
    );

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateStoredSettings(
    update: (
      currentSettings: StoredSearchEngineSettings,
    ) => StoredSearchEngineSettings,
  ) {
    const nextSettings = update(storedSettings);
    if (nextSettings === storedSettings) {
      return;
    }

    setStoredSettings(nextSettings);
    void platform.searchEngineSettings.save(nextSettings);
  }

  function selectSearchEngine(engineId: string) {
    updateStoredSettings((currentSettings) =>
      currentSettings.selectedEngineId === engineId
        ? currentSettings
        : {
            ...currentSettings,
            selectedEngineId: engineId,
          },
    );
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

    updateStoredSettings((currentSettings) => ({
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
        {/* 搜索框 */}
        <div className="flex h-12 items-center rounded-glass border border-white/50 bg-white/55 px-3 text-slate-800 shadow-[0_16px_42px_rgba(15,23,42,0.2)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-white/95 focus-within:bg-white/80 focus-within:shadow-[0_22px_58px_rgba(15,23,42,0.32)] motion-reduce:transition-none sm:h-[52px]">
          <Popover.Root open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <Popover.Trigger asChild>
              <button
                className="focus-visible:ring-glass-focus flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-slate-700 outline-none transition hover:bg-white/45 hover:text-slate-900 focus-visible:ring-2 motion-reduce:transition-none"
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
                className="glass-panel z-30 w-[calc(100vw-2rem)] max-w-[526px] overflow-hidden p-2"
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
                        "text-glass-content hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-glass-focus flex h-16 min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 text-center outline-none transition focus-visible:ring-2 motion-reduce:transition-none",
                        engine.id === selectedEngine.id &&
                          "bg-glass-selected text-glass-selected-content shadow-sm",
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
                    className="border-glass-border text-glass-content hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-glass-focus grid h-16 min-w-[88px] shrink-0 place-items-center rounded-xl border border-dashed outline-none transition focus-visible:ring-2 motion-reduce:transition-none"
                    type="button"
                    onClick={openAddDialog}
                    aria-label="新增搜索引擎"
                    title="新增搜索引擎"
                  >
                    <Plus aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <div className="mx-1 h-6 w-px shrink-0 bg-slate-500/30" />

          <form className="flex min-w-0 flex-1" onSubmit={handleSearchSubmit}>
            <input
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] font-semibold text-slate-800 outline-none placeholder:text-slate-600/75 sm:text-base"
              type="search"
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
          className="max-w-xl p-6 sm:p-8"
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
              <DialogTitle className="text-xl font-semibold">
                新增搜索引擎
              </DialogTitle>

              <label className="text-glass-content mt-6 block text-sm font-semibold">
                名称
                <input
                  className="border-glass-border text-glass-strong placeholder:text-glass-muted focus:border-glass-focus focus:ring-glass-focus mt-2 h-11 w-full rounded-xl border bg-white/15 px-4 text-base font-semibold outline-none transition focus:bg-white/20 focus:ring-2 motion-reduce:transition-none"
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

              <label className="text-glass-content mt-5 block text-sm font-semibold">
                网址格式（用“%s”代替搜索字词）
                <input
                  className="border-glass-border text-glass-strong placeholder:text-glass-muted focus:border-glass-focus focus:ring-glass-focus mt-2 h-11 w-full rounded-xl border bg-white/15 px-4 text-sm font-semibold outline-none transition focus:bg-white/20 focus:ring-2 motion-reduce:transition-none"
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
                  className="text-glass-content hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-glass-focus h-10 rounded-xl px-6 text-sm font-semibold outline-none transition focus-visible:ring-2 motion-reduce:transition-none"
                  type="button"
                  onClick={close}
                >
                  取消
                </button>
                <button
                  className="bg-action focus-visible:ring-glass-focus h-10 rounded-xl px-7 text-sm font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
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
