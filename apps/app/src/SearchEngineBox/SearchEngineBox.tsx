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
import { SearchEngineDialogs } from "./SearchEngineDialog";
import { SearchEngineSelector } from "./SearchEngineSelector";
import {
  SEARCH_ENGINE_SUGGESTIONS_ID,
  getSearchEngineSuggestionId,
  SearchEngineSuggestion,
} from "./SearchEngineSuggestion";
import {
  buildSearchUrl,
  createCustomEngineId,
  DEFAULT_SEARCH_ENGINES,
  EMPTY_CUSTOM_ENGINE,
  findSearchEngines,
  normalizeCustomEngines,
  type SearchEngine,
} from "./searchEngineUtils";

export function SearchEngineBox() {
  const { t } = useTranslation();
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
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
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
  const suggestedEngines = findSearchEngines(
    searchEngines,
    suggestionQuery,
  ).filter(
    (engine) => engine.id !== selectedEngine.id || engine.id === temporaryEngineId,
  );
  const visibleSuggestedEngines =
    dismissedSuggestionQuery === suggestionQuery ? [] : suggestedEngines;
  const activeSuggestedEngine =
    visibleSuggestedEngines[
      Math.min(activeSuggestionIndex, visibleSuggestedEngines.length - 1)
    ] ?? null;
  const isSuggestionOpen = Boolean(activeSuggestedEngine);

  useEffect(() => {
    setActiveSuggestionIndex(0);
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
    engine = activeSuggestedEngine,
    retainSuggestions = false,
  ) {
    if (!engine) return;
    setTemporaryEngineId(engine.id);
    setRetainedSuggestionQuery(retainSuggestions ? suggestionQuery : null);
    setQuery("");
    setDismissedSuggestionQuery(null);
    inputRef.current?.focus();
  }

  function selectAdjacentEngineSuggestion(direction: 1 | -1) {
    if (!activeSuggestedEngine) return;

    if (retainedSuggestionQuery === null) {
      acceptEngineSuggestion(activeSuggestedEngine, true);
      return;
    }

    const nextSuggestionIndex =
      (activeSuggestionIndex + direction + visibleSuggestedEngines.length) %
      visibleSuggestedEngines.length;
    setActiveSuggestionIndex(nextSuggestionIndex);
    acceptEngineSuggestion(visibleSuggestedEngines[nextSuggestionIndex], true);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && visibleSuggestedEngines.length > 0) {
      event.preventDefault();
      selectAdjacentEngineSuggestion(1);
      return;
    }

    if (event.key === "ArrowUp" && visibleSuggestedEngines.length > 0) {
      event.preventDefault();
      selectAdjacentEngineSuggestion(-1);
      return;
    }

    if (event.key === "Tab" && activeSuggestedEngine) {
      event.preventDefault();
      selectAdjacentEngineSuggestion(1);
      return;
    }

    if (event.key === "Escape" && visibleSuggestedEngines.length > 0) {
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
        open={visibleSuggestedEngines.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen && visibleSuggestedEngines.length > 0) {
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
                  ? "rounded-t-glass rounded-b-none border-b-slate-400/20 bg-slate-100"
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
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setRetainedSuggestionQuery(null);
                    setDismissedSuggestionQuery(null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.placeholder")}
                  aria-autocomplete="list"
                  aria-expanded={visibleSuggestedEngines.length > 0}
                  aria-controls={
                    visibleSuggestedEngines.length > 0
                      ? SEARCH_ENGINE_SUGGESTIONS_ID
                      : undefined
                  }
                  aria-activedescendant={
                    activeSuggestedEngine
                      ? getSearchEngineSuggestionId(activeSuggestedEngine.id)
                      : undefined
                  }
                />
              </form>
            </div>
          </Popover.Anchor>

          {visibleSuggestedEngines.length > 0 && activeSuggestedEngine ? (
            <SearchEngineSuggestion
              engines={visibleSuggestedEngines}
              activeEngineId={activeSuggestedEngine.id}
              onActiveEngineChange={(engineId) =>
                setActiveSuggestionIndex(
                  visibleSuggestedEngines.findIndex(
                    (engine) => engine.id === engineId,
                  ),
                )
              }
              onAccept={acceptEngineSuggestion}
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
