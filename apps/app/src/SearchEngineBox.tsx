import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDown, EllipsisVertical, Plus } from "lucide-react";
import { platform } from "@platform";
import type { StoredSearchEngineSettings } from "./platform/types";
import { Dialog, DialogTitle } from "./components/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./components/DropdownMenu";
import { SiteIcon } from "./components/SiteIcon";
import { useTranslation } from "react-i18next";

type SearchEngine = {
  id: string;
  name: string;
  urlFormat: string;
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
  const { t } = useTranslation();
  const [storedSettings, setStoredSettings] =
    useState<StoredSearchEngineSettings>({});
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditorDialogOpen, setIsEditorDialogOpen] = useState(false);
  const [editingEngineId, setEditingEngineId] = useState<string | null>(null);
  const [enginePendingDeletion, setEnginePendingDeletion] =
    useState<SearchEngine | null>(null);
  const [customEngineDraft, setCustomEngineDraft] =
    useState(EMPTY_CUSTOM_ENGINE);

  const customEngines = useMemo(
    () => normalizeCustomEngines(storedSettings.customEngines),
    [storedSettings.customEngines],
  );
  const searchEngines = useMemo(() => {
    const customEngineById = new Map(
      customEngines.map((engine) => [engine.id, engine]),
    );
    const defaultEngineIds = new Set(
      DEFAULT_SEARCH_ENGINES.map((engine) => engine.id),
    );
    const visibleDefaultEngines = DEFAULT_SEARCH_ENGINES.filter(
      (engine) => !storedSettings.hiddenDefaultEngineIds?.includes(engine.id),
    ).map((engine) => customEngineById.get(engine.id) ?? engine);
    const addedEngines = customEngines.filter(
      (engine) => !defaultEngineIds.has(engine.id),
    );

    return [...visibleDefaultEngines, ...addedEngines];
  }, [customEngines, storedSettings.hiddenDefaultEngineIds]);
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
    setEditingEngineId(null);
    setCustomEngineDraft(EMPTY_CUSTOM_ENGINE);
    setIsDropdownOpen(false);
    window.setTimeout(() => setIsEditorDialogOpen(true), 0);
  }

  function openEditDialog(engine: SearchEngine) {
    setEditingEngineId(engine.id);
    setCustomEngineDraft({ name: engine.name, urlFormat: engine.urlFormat });
    setIsDropdownOpen(false);
    window.setTimeout(() => setIsEditorDialogOpen(true), 0);
  }

  function handleSaveCustomEngine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = customEngineDraft.name.trim();
    const urlFormat = customEngineDraft.urlFormat.trim();
    if (!name || !urlFormat) {
      return;
    }

    if (editingEngineId) {
      updateStoredSettings((currentSettings) => ({
        ...currentSettings,
        customEngines: (currentSettings.customEngines ?? []).some(
          (engine) => engine.id === editingEngineId,
        )
          ? (currentSettings.customEngines ?? []).map((engine) =>
              engine.id === editingEngineId
                ? { ...engine, name, urlFormat }
                : engine,
            )
          : [
              ...(currentSettings.customEngines ?? []),
              { id: editingEngineId, name, urlFormat },
            ],
      }));
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

  function deleteSearchEngine(engine: SearchEngine) {
    const fallbackEngineId = searchEngines.find(
      (candidate) => candidate.id !== engine.id,
    )?.id;
    if (!fallbackEngineId) {
      return;
    }

    const isDefaultEngine = DEFAULT_SEARCH_ENGINES.some(
      (defaultEngine) => defaultEngine.id === engine.id,
    );
    updateStoredSettings((currentSettings) => ({
      ...currentSettings,
      selectedEngineId:
        currentSettings.selectedEngineId === engine.id
          ? fallbackEngineId
          : currentSettings.selectedEngineId,
      hiddenDefaultEngineIds: isDefaultEngine
        ? Array.from(
            new Set([
              ...(currentSettings.hiddenDefaultEngineIds ?? []),
              engine.id,
            ]),
          )
        : currentSettings.hiddenDefaultEngineIds,
      customEngines: (currentSettings.customEngines ?? []).filter(
        (customEngine) => customEngine.id !== engine.id,
      ),
    }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    window.open(
      buildSearchUrl(selectedEngine.urlFormat, trimmedQuery),
      "_parent",
      "noreferrer",
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
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-slate-700 outline-none transition hover:bg-white/45 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
                type="button"
                aria-label={t("search.selectEngine", {
                  name: selectedEngine.name,
                })}
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
                  aria-label={t("search.engines")}
                >
                  {searchEngines.map((engine) => (
                    <div key={engine.id} className="group relative shrink-0">
                      <button
                        className={clsx(
                          "flex h-16 min-w-[88px] flex-col items-center justify-center gap-1 rounded-xl px-3 text-center text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none",
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
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-slate-800/80 text-white/80 shadow-sm outline-none transition hover:bg-slate-800 hover:text-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-glass-focus data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            type="button"
                            aria-label={t("search.moreActionsFor", {
                              name: engine.name,
                            })}
                            title={t("search.moreActions")}
                          >
                            <EllipsisVertical
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenuContent className="z-50 text-sm text-glass-content">
                            <DropdownMenuItem
                              onSelect={() => openEditDialog(engine)}
                            >
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="danger"
                              disabled={searchEngines.length === 1}
                              onSelect={() => {
                                setIsDropdownOpen(false);
                                window.setTimeout(
                                  () => setEnginePendingDeletion(engine),
                                  0,
                                );
                              }}
                            >
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  ))}
                  <button
                    className="grid h-16 min-w-[88px] shrink-0 place-items-center rounded-xl border border-dashed border-glass-border text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
                    type="button"
                    onClick={openAddDialog}
                    aria-label={t("search.addEngine")}
                    title={t("search.addEngine")}
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
              placeholder={t("search.placeholder")}
              aria-label={t("search.placeholder")}
            />
          </form>
        </div>
      </div>

      {isEditorDialogOpen ? (
        <Dialog
          className="max-w-xl p-6 sm:p-8"
          onClose={() => setIsEditorDialogOpen(false)}
        >
          {(close) => (
            <form
              onSubmit={(event) => {
                handleSaveCustomEngine(event);
                if (canSaveCustomEngine) close();
              }}
              aria-label={t(
                editingEngineId ? "search.editEngine" : "search.addEngine",
              )}
            >
              <DialogTitle className="text-xl font-semibold">
                {t(editingEngineId ? "search.editEngine" : "search.addEngine")}
              </DialogTitle>

              <label className="mt-6 block text-sm font-semibold text-glass-content">
                {t("search.name")}
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-base font-semibold text-glass-strong outline-none transition placeholder:text-white/70 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
                  value={customEngineDraft.name}
                  onChange={(event) =>
                    setCustomEngineDraft((draft) => ({
                      ...draft,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Google"
                />
              </label>

              <label className="mt-5 block text-sm font-semibold text-glass-content">
                {t("search.urlFormat")}
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-sm font-semibold text-glass-strong outline-none transition placeholder:text-white/70 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
                  value={customEngineDraft.urlFormat}
                  onChange={(event) =>
                    setCustomEngineDraft((draft) => ({
                      ...draft,
                      urlFormat: event.target.value,
                    }))
                  }
                  placeholder="https://www.google.com/search?q=%s"
                />
              </label>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
                  type="button"
                  onClick={close}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-xl bg-action px-7 text-sm font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                  type="submit"
                  disabled={!canSaveCustomEngine}
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          )}
        </Dialog>
      ) : null}

      {enginePendingDeletion ? (
        <Dialog
          className="max-w-md p-7"
          onClose={() => setEnginePendingDeletion(null)}
        >
          {(close) => (
            <>
              <DialogTitle className="text-xl font-semibold">
                {t("search.deleteEngine")}
              </DialogTitle>
              <p className="mt-3 text-sm leading-6 text-glass-content">
                {t("search.deleteConfirm", {
                  name: enginePendingDeletion.name,
                })}
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button
                  className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus"
                  type="button"
                  onClick={close}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-xl bg-red-500 px-6 text-sm font-semibold text-white outline-none transition hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-glass-focus"
                  type="button"
                  onClick={() => {
                    deleteSearchEngine(enginePendingDeletion);
                    close();
                  }}
                >
                  {t("common.delete")}
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
