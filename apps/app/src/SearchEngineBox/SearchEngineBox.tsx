import { toast } from "sonner";
import { useRef, useState, type SubmitEvent, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { platform } from "@platform";
import type { SearchEngine, UrlSearchEngine } from "./schema";
import { useSearchEngineSettings } from "./useSearchEngineSettings";
import { useBookmarkNavigation } from "../Launcher/BookmarkNavigationProvider";
import { useBookmarks } from "../Launcher/BookmarkProvider";
import {
  SearchEngineEditorDialog,
  DeleteSearchEngineDialog,
} from "./SearchEngineDialog";
import { SearchEngineSelector } from "./SearchEngineSelector";
import {
  SEARCH_SUGGESTIONS_ID,
  getSearchSuggestionId,
  SearchSuggestion,
} from "./SearchSuggestion";
import {
  submitSearch,
  createCustomEngineId,
  InvalidSearchEngineUrlError,
} from "./searchEngineUtils";
import {
  findSearchSuggestions,
  getSearchSuggestionKey,
  type SearchSuggestion as SearchSuggestionItem,
} from "./searchSuggestionUtils";

export function SearchEngineBox() {
  const { t } = useTranslation();
  const { bookmarks } = useBookmarks();
  const { revealBookmark } = useBookmarkNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchBoxAnchor, setSearchBoxAnchor] = useState<HTMLDivElement | null>(
    null,
  );
  const {
    engines: searchEngines,
    selectedEngine,
    isLoaded: isSettingsLoaded,
    isSaving,
    select,
    save,
    add,
    remove,
  } = useSearchEngineSettings();
  const [query, setQuery] = useState("");
  const [temporaryEngineId, setTemporaryEngineId] = useState<string | null>(
    null,
  );
  const [isEngineSelectorOpen, setEngineSelectorOpen] = useState(false);
  const [dismissedSuggestionQuery, setDismissedSuggestionQuery] = useState<
    string | null
  >(null);
  const [retainedSuggestionQuery, setRetainedSuggestionQuery] = useState<
    string | null
  >(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    number | null
  >(null);
  const [editor, setEditor] = useState<{
    engine?: UrlSearchEngine;
    id: string;
  } | null>(null);
  const [enginePendingDeletion, setEnginePendingDeletion] =
    useState<UrlSearchEngine | null>(null);

  const temporaryEngine = temporaryEngineId
    ? (searchEngines.find((engine) => engine.id === temporaryEngineId) ?? null)
    : null;
  const effectiveEngine = temporaryEngine ?? selectedEngine;
  const searchLabel =
    effectiveEngine.kind === "browser"
      ? t("search.browserDefault")
      : t("search.useEngine", { name: effectiveEngine.name });
  const suggestionQuery = retainedSuggestionQuery ?? query;
  const suggestions = findSearchSuggestions({
    engines: searchEngines,
    bookmarks,
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

  function selectSearchEngine(engineId: string) {
    void select(engineId);
    setTemporaryEngineId(null);
    setEngineSelectorOpen(false);
  }

  function acceptEngineSuggestion(
    engine: SearchEngine,
    retainSuggestions = false,
  ) {
    if (!retainSuggestions) setActiveSuggestionIndex(null);
    setTemporaryEngineId(engine.id);
    setRetainedSuggestionQuery(retainSuggestions ? suggestionQuery : null);
    setQuery("");
    setDismissedSuggestionQuery(null);
    inputRef.current?.focus();
  }

  function openBookmarkSuggestion(suggestion: SearchSuggestionItem) {
    if (suggestion.type !== "bookmark") return;
    window.open(suggestion.bookmark.url, "_parent", "noreferrer");
  }

  function locateBookmarkSuggestion(bookmarkId: string) {
    revealBookmark(bookmarkId);
    setActiveSuggestionIndex(null);
    setDismissedSuggestionQuery(suggestionQuery);
    setRetainedSuggestionQuery(null);
  }

  function acceptSuggestion(
    suggestion: SearchSuggestionItem,
    retainSuggestions = false,
  ) {
    if (suggestion.type === "engine") {
      acceptEngineSuggestion(suggestion.engine, retainSuggestions);
      return;
    }

    openBookmarkSuggestion(suggestion);
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
    } else {
      // A bookmark selection should not keep showing the previously selected
      // temporary engine in the search box.
      setTemporaryEngineId(null);
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
      // Match focus navigation: Tab moves forward, while Shift+Tab moves backward.
      selectAdjacentSuggestion(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === "Escape" && visibleSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex(null);
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

  function handleSearchSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSettingsLoaded) return;
    if (activeSuggestion?.type === "bookmark") {
      openBookmarkSuggestion(activeSuggestion);
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const search = submitSearch(effectiveEngine, trimmedQuery, platform.search);
    void search.catch((error: unknown) => {
      console.error("Failed to search", error);
      toast.error(
        t(
          error instanceof InvalidSearchEngineUrlError
            ? "search.invalidUrl"
            : "search.failed",
        ),
      );
    });
  }

  return (
    <>
      <Popover.Root
        open={visibleSuggestions.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen && visibleSuggestions.length > 0) {
            setActiveSuggestionIndex(null);
            setDismissedSuggestionQuery(suggestionQuery);
            setRetainedSuggestionQuery(null);
          }
        }}
        modal={false}
      >
        <div className="relative mx-auto w-full max-w-[526px]" role="search">
          <div
            ref={setSearchBoxAnchor}
            className={clsx(
              "flex h-12 cursor-text items-center border border-white/50 px-3.5 text-slate-800 shadow-[0_16px_42px_rgba(15,23,42,0.2)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-white/95 focus-within:shadow-[0_22px_58px_rgba(15,23,42,0.32)] motion-reduce:transition-none sm:h-[52px] [&_button]:cursor-pointer",
              isSuggestionOpen
                ? "rounded-b-none rounded-t-glass border-b-slate-400/20 bg-slate-100"
                : "rounded-glass bg-white/55 focus-within:bg-white/80",
            )}
            onClick={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest("button, a, input")
              ) {
                return;
              }

              inputRef.current?.focus();
            }}
          >
            <SearchEngineSelector
              anchorElement={searchBoxAnchor}
              engines={searchEngines}
              selectedEngine={selectedEngine}
              temporaryEngine={temporaryEngine}
              isOpen={isEngineSelectorOpen}
              disabled={!isSettingsLoaded || isSaving}
              onOpenChange={setEngineSelectorOpen}
              onSelect={selectSearchEngine}
              onClearTemporary={() => setTemporaryEngineId(null)}
              onAdd={() => setEditor({ id: createCustomEngineId() })}
              onEdit={(engine) => setEditor({ engine, id: engine.id })}
              onRequestDelete={setEnginePendingDeletion}
            />

            <div className="mx-3 h-6 w-px shrink-0 bg-slate-500/30" />

            <form
              className="flex min-w-0 flex-1 items-center"
              onSubmit={handleSearchSubmit}
            >
              <input
                ref={inputRef}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-600/75 sm:text-base [&::-webkit-search-cancel-button]:appearance-none"
                type="search"
                disabled={!isSettingsLoaded || isSaving}
                role="combobox"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveSuggestionIndex(null);
                  setRetainedSuggestionQuery(null);
                  setDismissedSuggestionQuery(null);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={searchLabel}
                aria-label={searchLabel}
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

          {visibleSuggestions.length > 0 ? (
            <SearchSuggestion
              anchorElement={searchBoxAnchor}
              suggestions={visibleSuggestions}
              activeSuggestionKey={
                activeSuggestion
                  ? getSearchSuggestionKey(activeSuggestion)
                  : null
              }
              onAccept={acceptSuggestion}
              onLocateBookmark={locateBookmarkSuggestion}
            />
          ) : null}
        </div>
      </Popover.Root>

      {editor && (
        <SearchEngineEditorDialog
          engine={editor.engine}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            const success = editor.engine
              ? await save(draft, editor.id)
              : await add(draft, editor.id);
            if (success) setTemporaryEngineId(null);
            return success;
          }}
        />
      )}
      {enginePendingDeletion && (
        <DeleteSearchEngineDialog
          engine={enginePendingDeletion}
          onClose={() => setEnginePendingDeletion(null)}
          onDelete={async () => {
            const success = await remove(enginePendingDeletion);
            if (temporaryEngineId === enginePendingDeletion.id)
              setTemporaryEngineId(null);
            return success;
          }}
        />
      )}
    </>
  );
}
