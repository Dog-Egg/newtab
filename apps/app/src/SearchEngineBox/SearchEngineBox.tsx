import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { platform } from "@platform";
import type { StoredSearchEngineSettings } from "../platform/types";
import { useLauncher } from "../Launcher/LauncherProvider";
import { SearchEngineDialogs } from "./SearchEngineDialog";
import { SearchEngineSelector } from "./SearchEngineSelector";
import {
  SEARCH_SUGGESTIONS_ID,
  getSearchSuggestionId,
  SearchSuggestion,
} from "./SearchSuggestion";
import {
  buildSearchUrl,
  createCustomEngineId,
  DEFAULT_SEARCH_ENGINES,
  EMPTY_CUSTOM_ENGINE,
  normalizeCustomEngines,
  type SearchEngine,
} from "./searchEngineUtils";
import {
  findSearchSuggestions,
  getSearchSuggestionKey,
  type SearchSuggestion as SearchSuggestionItem,
} from "./searchSuggestionUtils";

export function SearchEngineBox() {
  const { t } = useTranslation();
  const { categories: shortcutCategories } = useLauncher();
  const inputRef = useRef<HTMLInputElement>(null);
  const [storedSettings, setStoredSettings] =
    useState<StoredSearchEngineSettings>({});
  const [query, setQuery] = useState("");
  const [temporaryEngineId, setTemporaryEngineId] = useState<string | null>(
    null,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dismissedSuggestionQuery, setDismissedSuggestionQuery] = useState<
    string | null
  >(null);
  const [retainedSuggestionQuery, setRetainedSuggestionQuery] = useState<
    string | null
  >(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    number | null
  >(null);
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
  const temporaryEngine = temporaryEngineId
    ? (searchEngines.find((engine) => engine.id === temporaryEngineId) ?? null)
    : null;
  const effectiveEngine = temporaryEngine ?? selectedEngine;
  const suggestionQuery = retainedSuggestionQuery ?? query;
  const suggestions = findSearchSuggestions({
    engines: searchEngines,
    categories: shortcutCategories,
    input: suggestionQuery,
    selectedEngineId: selectedEngine.id,
    temporaryEngineId,
  });
  const visibleSuggestions =
    dismissedSuggestionQuery === suggestionQuery ? [] : suggestions;
  const activeSuggestion =
    activeSuggestionIndex === null
      ? null
      : (visibleSuggestions[
          Math.min(activeSuggestionIndex, visibleSuggestions.length - 1)
        ] ?? null);
  const isSuggestionOpen = visibleSuggestions.length > 0;

  useEffect(() => {
    setActiveSuggestionIndex(null);
  }, [suggestionQuery]);

  useEffect(() => {
    let isCurrent = true;

    void platform.searchEngineSettings.read().then(
      (settings) => {
        if (isCurrent) setStoredSettings(settings);
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
    if (nextSettings === storedSettings) return;

    setStoredSettings(nextSettings);
    void platform.searchEngineSettings.save(nextSettings);
  }

  function selectSearchEngine(engineId: string) {
    updateStoredSettings((currentSettings) =>
      currentSettings.selectedEngineId === engineId
        ? currentSettings
        : { ...currentSettings, selectedEngineId: engineId },
    );
    setTemporaryEngineId(null);
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
    if (!name || !urlFormat) return;

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

    const nextCustomEngine = { id: createCustomEngineId(), name, urlFormat };
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
    if (!fallbackEngineId) return;

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
    if (temporaryEngineId === engine.id) setTemporaryEngineId(null);
  }

  function acceptEngineSuggestion(
    engine: SearchEngine,
    retainSuggestions = false,
  ) {
    setTemporaryEngineId(engine.id);
    setRetainedSuggestionQuery(retainSuggestions ? suggestionQuery : null);
    setQuery("");
    setDismissedSuggestionQuery(null);
    inputRef.current?.focus();
  }

  function openShortcutSuggestion(suggestion: SearchSuggestionItem) {
    if (suggestion.type !== "shortcut") return;
    window.open(suggestion.shortcut.url, "_parent", "noreferrer");
  }

  function acceptSuggestion(
    suggestion: SearchSuggestionItem,
    retainSuggestions = false,
  ) {
    if (suggestion.type === "engine") {
      acceptEngineSuggestion(suggestion.engine, retainSuggestions);
      return;
    }

    openShortcutSuggestion(suggestion);
  }

  function selectAdjacentSuggestion(direction: 1 | -1) {
    const nextSuggestionIndex =
      activeSuggestionIndex === null
        ? direction === 1
          ? 0
          : visibleSuggestions.length - 1
        : (activeSuggestionIndex + direction + visibleSuggestions.length) %
          visibleSuggestions.length;
    const nextSuggestion = visibleSuggestions[nextSuggestionIndex];
    setActiveSuggestionIndex(nextSuggestionIndex);
    if (nextSuggestion.type === "engine") {
      acceptEngineSuggestion(nextSuggestion.engine, true);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && visibleSuggestions.length > 0) {
      event.preventDefault();
      selectAdjacentSuggestion(1);
      return;
    }

    if (event.key === "ArrowUp" && visibleSuggestions.length > 0) {
      event.preventDefault();
      selectAdjacentSuggestion(-1);
      return;
    }

    if (event.key === "Tab" && visibleSuggestions.length > 0) {
      event.preventDefault();
      selectAdjacentSuggestion(1);
      return;
    }

    if (event.key === "Escape" && visibleSuggestions.length > 0) {
      event.preventDefault();
      setDismissedSuggestionQuery(suggestionQuery);
      setRetainedSuggestionQuery(null);
      return;
    }

    if (event.key === "Escape" && temporaryEngine) {
      event.preventDefault();
      setTemporaryEngineId(null);
      return;
    }

    if (event.key === "Backspace" && temporaryEngine && query === "") {
      event.preventDefault();
      setTemporaryEngineId(null);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeSuggestion?.type === "shortcut") {
      openShortcutSuggestion(activeSuggestion);
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    window.open(
      buildSearchUrl(effectiveEngine.urlFormat, trimmedQuery),
      "_parent",
      "noreferrer",
    );
  }

  return (
    <>
      <Popover.Root
        open={visibleSuggestions.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen && visibleSuggestions.length > 0) {
            setDismissedSuggestionQuery(suggestionQuery);
            setRetainedSuggestionQuery(null);
          }
        }}
      >
        <div className="relative mx-auto w-full max-w-[526px]" role="search">
          <Popover.Anchor asChild>
            <div
              className={clsx(
                "flex h-12 items-center border border-white/50 px-3 text-slate-800 shadow-[0_16px_42px_rgba(15,23,42,0.2)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-white/95 focus-within:shadow-[0_22px_58px_rgba(15,23,42,0.32)] motion-reduce:transition-none sm:h-[52px]",
                isSuggestionOpen
                  ? "rounded-b-none rounded-t-glass border-b-slate-400/20 bg-slate-100"
                  : "rounded-glass bg-white/55 focus-within:bg-white/80",
              )}
            >
              <SearchEngineSelector
                engines={searchEngines}
                selectedEngine={selectedEngine}
                temporaryEngine={temporaryEngine}
                isOpen={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
                onSelect={selectSearchEngine}
                onAdd={openAddDialog}
                onEdit={openEditDialog}
                onRequestDelete={(engine) => {
                  setIsDropdownOpen(false);
                  window.setTimeout(() => setEnginePendingDeletion(engine), 0);
                }}
              />

              <div className="mx-1 h-6 w-px shrink-0 bg-slate-500/30" />

              <form
                className="flex min-w-0 flex-1 items-center"
                onSubmit={handleSearchSubmit}
              >
                <input
                  ref={inputRef}
                  className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-600/75 sm:text-base"
                  type="search"
                  role="combobox"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveSuggestionIndex(null);
                    setRetainedSuggestionQuery(null);
                    setDismissedSuggestionQuery(null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.placeholder")}
                  aria-autocomplete="list"
                  aria-expanded={visibleSuggestions.length > 0}
                  aria-controls={
                    visibleSuggestions.length > 0
                      ? SEARCH_SUGGESTIONS_ID
                      : undefined
                  }
                  aria-activedescendant={
                    activeSuggestion
                      ? getSearchSuggestionId(activeSuggestion)
                      : undefined
                  }
                />
              </form>
            </div>
          </Popover.Anchor>

          {visibleSuggestions.length > 0 ? (
            <SearchSuggestion
              suggestions={visibleSuggestions}
              activeSuggestionKey={
                activeSuggestion
                  ? getSearchSuggestionKey(activeSuggestion)
                  : null
              }
              onAccept={acceptSuggestion}
            />
          ) : null}
        </div>
      </Popover.Root>

      <SearchEngineDialogs
        isEditorOpen={isEditorDialogOpen}
        editingEngineId={editingEngineId}
        draft={customEngineDraft}
        onDraftChange={setCustomEngineDraft}
        onCloseEditor={() => setIsEditorDialogOpen(false)}
        onSave={handleSaveCustomEngine}
        enginePendingDeletion={enginePendingDeletion}
        onCloseDeletion={() => setEnginePendingDeletion(null)}
        onDelete={deleteSearchEngine}
      />
    </>
  );
}
