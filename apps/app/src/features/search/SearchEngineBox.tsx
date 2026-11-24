import { toast } from "sonner";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import { Popover } from "@base-ui/react/popover";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { platform } from "@platform";
import type { SearchEngine, UrlSearchEngine } from "./schema";
import { useSearchEngineSettings } from "./use-search-engine-settings";
import { useBookmarkNavigationStore } from "../launcher/bookmark-navigation-store";
import { useBookmarksStore } from "../../bookmarks/store";
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
} from "./search-engine-utils";
import {
  findSearchSuggestions,
  getSearchSuggestionKey,
  type SearchSuggestion as SearchSuggestionItem,
} from "./search-suggestion-utils";

const dividerWidth = "mx-3 w-px shrink-0";

export function SearchEngineBox() {
  const { t } = useTranslation();
  const bookmarks = useBookmarksStore((state) => state.bookmarks);
  const recordBookmarkClick = useBookmarksStore(
    (state) => state.recordBookmarkClick,
  );
  const revealBookmark = useBookmarkNavigationStore(
    (state) => state.revealBookmark,
  );
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
  const hasTemporaryEngine = temporaryEngine !== null;

  const hasLineBreak = query.includes("\n");
  const {
    inputRef,
    engineRef,
    singleLineSpaceRef,
    queryWidthRef,
    queryForWidthMeasurement,
    isMultiline,
  } = useSearchInputLayout({ query, hasLineBreak, temporaryEngine });

  const effectiveEngine = temporaryEngine ?? selectedEngine;
  const searchLabel =
    effectiveEngine.kind === "browser"
      ? t("search.browserDefault")
      : t("search.useEngine", { name: effectiveEngine.name });
  const suggestionQuery = retainedSuggestionQuery ?? query;
  const visibleSuggestions =
    hasLineBreak || dismissedSuggestionQuery === suggestionQuery
      ? []
      : findSearchSuggestions({
          engines: searchEngines,
          bookmarks,
          input: suggestionQuery,
          selectedEngineId: selectedEngine.id,
          temporaryEngineId,
        });
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
    recordBookmarkClick(suggestion.bookmark.id);
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

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Some browsers report the Enter that confirms IME composition as key 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (event.key === "Enter") {
      if (
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
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
              "relative flex min-h-12 cursor-text items-start border border-white/50 px-3.5 text-[15px] leading-6 text-slate-800 shadow-[0_16px_42px_rgba(15,23,42,0.2)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-white/95 focus-within:shadow-[0_22px_58px_rgba(15,23,42,0.32)] motion-reduce:transition-none sm:min-h-[52px] sm:text-base/6 [&_button]:cursor-pointer",
              isMultiline
                ? "flex-col gap-1 py-2.5 sm:py-3"
                : "py-[5px] sm:py-[7px]",
              isSuggestionOpen
                ? "rounded-b-none rounded-t-glass border-b-slate-400/20 bg-slate-100"
                : "rounded-glass bg-white/55 focus-within:bg-white/80",
            )}
            onClick={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest("button, a, textarea")
              ) {
                return;
              }

              inputRef.current?.focus();
            }}
          >
            <div ref={engineRef} className="shrink-0">
              <SearchEngineSelector
                anchorElement={searchBoxAnchor}
                engines={searchEngines}
                selectedEngine={selectedEngine}
                temporaryEngine={temporaryEngine}
                showEngineName={isMultiline}
                isOpen={isEngineSelectorOpen}
                disabled={!isSettingsLoaded || isSaving}
                onOpenChange={setEngineSelectorOpen}
                onSelect={selectSearchEngine}
                onClearTemporary={() => setTemporaryEngineId(null)}
                onAdd={() => setEditor({ id: createCustomEngineId() })}
                onEdit={(engine) => setEditor({ engine, id: engine.id })}
                onRequestDelete={setEnginePendingDeletion}
              />
            </div>

            {!isMultiline && (
              <div
                aria-hidden="true"
                className={clsx(
                  dividerWidth,
                  "my-1.5 self-stretch bg-slate-500/30",
                )}
              />
            )}

            <form
              className={
                isMultiline ? "w-full py-0.5" : "min-w-0 flex-1 py-1.5"
              }
              onSubmit={handleSearchSubmit}
            >
              <textarea
                ref={inputRef}
                className="block max-h-24 min-h-6 w-full resize-none overflow-y-auto break-words bg-transparent outline-none [field-sizing:content] placeholder:text-slate-600/75 [@media(max-height:420px)]:max-h-12 [@media(min-height:421px)_and_(max-height:600px)]:max-h-[4.5rem]"
                rows={1}
                disabled={!isSettingsLoaded || isSaving}
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

            <div
              aria-hidden="true"
              className="pointer-events-none invisible absolute inset-x-3.5 top-0 flex h-0 overflow-hidden"
            >
              {!hasTemporaryEngine && <span className="w-10 shrink-0" />}
              <span className={dividerWidth} />
              <div ref={singleLineSpaceRef} className="min-w-0 flex-1">
                <span
                  ref={queryWidthRef}
                  className="inline-block whitespace-pre"
                >
                  {queryForWidthMeasurement}
                </span>
              </div>
            </div>
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
              onRecordBookmark={recordBookmarkClick}
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

function resizeSearchInput(input: HTMLTextAreaElement) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function getQueryForWidthMeasurement(query: string) {
  // The textarea lets trailing spaces and tabs hang past the line edge.
  let end = query.length;
  while (end > 0 && /[ \t\u3000]/.test(query[end - 1])) end--;
  return query.slice(0, end);
}

function useSearchInputLayout({
  query,
  hasLineBreak,
  temporaryEngine,
}: {
  query: string;
  hasLineBreak: boolean;
  temporaryEngine: SearchEngine | null;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const singleLineSpaceRef = useRef<HTMLDivElement>(null);
  const queryWidthRef = useRef<HTMLSpanElement>(null);
  const [queryExceedsSingleLine, setQueryExceedsSingleLine] = useState(false);
  const hasTemporaryEngine = temporaryEngine !== null;
  const isMultiline = hasLineBreak || queryExceedsSingleLine;
  const previousMultiline = useRef(isMultiline);

  useLayoutEffect(() => {
    if (previousMultiline.current === isMultiline) return;
    previousMultiline.current = isMultiline;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
      return;

    const animation = inputRef.current?.animate?.(
      [
        { transform: `translateY(${isMultiline ? -5 : 5}px)` },
        { transform: "translateY(0)" },
      ],
      { duration: 150, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [isMultiline]);

  const needsInputResize = !globalThis.CSS?.supports?.(
    "field-sizing",
    "content",
  );
  useLayoutEffect(() => {
    if (needsInputResize && inputRef.current)
      resizeSearchInput(inputRef.current);
  }, [isMultiline, needsInputResize, query]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!needsInputResize || !input) return;

    // A narrower viewport or a temporary engine label can change line breaks.
    let width = input.offsetWidth;
    let frame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (input.offsetWidth === width) return;
      width = input.offsetWidth;
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        resizeSearchInput(input);
      });
    });
    observer.observe(input);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [needsInputResize]);

  // Compare against the compact layout even after giving the editor full width.
  const updateMultilineLayout = useCallback(() => {
    const space = singleLineSpaceRef.current;
    const text = queryWidthRef.current;
    if (!space || !text) return;

    const engineWidth = hasTemporaryEngine
      ? (engineRef.current?.getBoundingClientRect().width ?? 0)
      : 0;
    setQueryExceedsSingleLine(
      text.getBoundingClientRect().width >
        space.getBoundingClientRect().width - engineWidth,
    );
  }, [hasTemporaryEngine]);

  useLayoutEffect(() => {
    updateMultilineLayout();
  }, [query, temporaryEngine, updateMultilineLayout]);

  useLayoutEffect(() => {
    let frame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        updateMultilineLayout();
      });
    });
    for (const element of [
      singleLineSpaceRef.current,
      queryWidthRef.current,
      engineRef.current,
    ]) {
      if (element) observer.observe(element);
    }
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [updateMultilineLayout]);

  return {
    inputRef,
    engineRef,
    singleLineSpaceRef,
    queryWidthRef,
    queryForWidthMeasurement: getQueryForWidthMeasurement(query),
    isMultiline,
  };
}
