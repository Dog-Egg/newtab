import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { LocateFixed, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SiteIcon } from "../components/SiteIcon";
import {
  getSearchEngineDomain,
  getSearchEngineIconSource,
  type TextMatch,
} from "./searchEngineUtils";
import {
  getSearchSuggestionKey,
  type SearchSuggestion as SearchSuggestionItem,
} from "./searchSuggestionUtils";

export const SEARCH_SUGGESTIONS_ID = "search-suggestions";

export function getSearchSuggestionId(suggestion: SearchSuggestionItem) {
  return `search-suggestion-${getSearchSuggestionKey(suggestion)}`;
}

function getBookmarkDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getHighlightedTextParts(text: string, matches: TextMatch[]) {
  const sortedMatches = [...matches]
    .filter((match) => match.length > 0 && match.start < text.length)
    .sort((left, right) => left.start - right.start);
  const parts: { text: string; isMatch: boolean }[] = [];
  let startIndex = 0;

  for (const match of sortedMatches) {
    const matchStart = Math.max(match.start, startIndex);
    const matchEnd = Math.min(match.start + match.length, text.length);
    if (matchEnd <= matchStart) continue;

    if (matchStart > startIndex) {
      parts.push({ text: text.slice(startIndex, matchStart), isMatch: false });
    }
    parts.push({
      text: text.slice(matchStart, matchEnd),
      isMatch: true,
    });
    startIndex = matchEnd;
  }

  if (startIndex < text.length) {
    parts.push({ text: text.slice(startIndex), isMatch: false });
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
}

function HighlightedText({
  text,
  matches,
}: {
  text: string;
  matches: TextMatch[];
}) {
  return getHighlightedTextParts(text, matches).map((part, index) =>
    part.isMatch ? (
      <strong key={index} className="font-bold">
        {part.text}
      </strong>
    ) : (
      part.text
    ),
  );
}

export function SearchSuggestion({
  suggestions,
  activeSuggestionKey,
  onAccept,
  onLocateBookmark,
}: {
  suggestions: SearchSuggestionItem[];
  activeSuggestionKey: string | null;
  onAccept: (suggestion: SearchSuggestionItem) => void;
  onLocateBookmark: (bookmarkId: string) => void;
}) {
  const { t } = useTranslation();
  const activeItemRef = useRef<HTMLElement>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeSuggestionKey]);

  return (
    <Popover.Portal>
      <Popover.Content
        id={SEARCH_SUGGESTIONS_ID}
        className="glass-panel z-20 flex max-h-[min(50rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] flex-col gap-1 overflow-y-auto rounded-b-glass rounded-t-none border-t-0 border-white/95 bg-slate-100 p-1.5 pt-2 shadow-none"
        side="bottom"
        align="start"
        sideOffset={-3 /* Prevent a 1px seam in scaled store-asset iframes. */}
        avoidCollisions={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        role="listbox"
        aria-label={t("search.suggestions")}
      >
        {suggestions.map((suggestion) => {
          const suggestionKey = getSearchSuggestionKey(suggestion);
          const isActive = suggestionKey === activeSuggestionKey;
          const isEngine = suggestion.type === "engine";
          const title = isEngine
            ? suggestion.engine.name
            : suggestion.bookmark.title;
          const url = isEngine
            ? getSearchEngineIconSource(suggestion.engine.urlFormat)
            : suggestion.bookmark.url;
          const domain = isEngine
            ? getSearchEngineDomain(suggestion.engine)
            : getBookmarkDomain(suggestion.bookmark.url);
          const engineActionText = isEngine
            ? t("search.useEngine", { name: suggestion.engine.name })
            : "";

          const className = clsx(
            "group relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-[14px] px-3 text-left text-slate-700 outline-none transition-colors duration-150 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:ring-offset-1 focus-within:ring-offset-white/20 motion-reduce:transition-none",
            "hover:bg-slate-200/60 hover:text-slate-950 hover:ring-1 hover:ring-slate-300/60",
            isActive &&
              "bg-slate-200/60 text-slate-950 ring-1 ring-slate-300/60",
          );
          const rowChrome = isActive ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 left-0 z-20 w-1 rounded-r-full bg-blue-600"
            />
          ) : null;
          const content = (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SiteIcon
                title={title}
                url={url}
                seed={suggestionKey}
                format="png"
                className="size-7 rounded-full text-[12px] font-black"
              />

              {isEngine ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {domain ? (
                      <HighlightedText
                        text={domain}
                        matches={suggestion.matches.domain}
                      />
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 rounded-[11px] border border-slate-300/90 bg-white/65 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 group-hover:border-slate-400/90 group-hover:bg-white/90 motion-reduce:transition-none">
                    <Search aria-hidden="true" className="size-4" />
                    {engineActionText}
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <HighlightedText
                      text={suggestion.bookmark.title}
                      matches={suggestion.matches.title}
                    />
                  </span>
                  <span
                    className={clsx(
                      "max-w-[45%] shrink-0 truncate text-sm text-slate-500 transition-[color,margin,opacity] duration-150 group-hover:mr-9 group-hover:text-slate-700 group-hover:opacity-75 motion-reduce:transition-none",
                    )}
                  >
                    <HighlightedText
                      text={domain ?? ""}
                      matches={suggestion.matches.domain}
                    />
                  </span>
                </>
              )}
            </div>
          );

          if (!isEngine) {
            return (
              <div
                ref={
                  isActive
                    ? (element) => {
                        activeItemRef.current = element;
                      }
                    : undefined
                }
                key={suggestionKey}
                id={getSearchSuggestionId(suggestion)}
                className={clsx(className, "group relative")}
                role="option"
                aria-selected={isActive}
                data-active={isActive ? "true" : undefined}
              >
                {rowChrome}
                <a
                  className="flex min-w-0 flex-1 items-center gap-3 self-stretch"
                  href={suggestion.bookmark.url}
                  target="_parent"
                  rel="noreferrer"
                >
                  {content}
                </a>
                <button
                  type="button"
                  className="pointer-events-none absolute right-3 grid size-7 place-items-center rounded-full border border-slate-300/70 bg-white/65 text-slate-500 opacity-0 outline-none transition-[background-color,border-color,color,opacity] duration-150 hover:border-blue-500/70 hover:bg-blue-600 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500/60 group-hover:pointer-events-auto group-hover:opacity-100 motion-reduce:transition-none"
                  aria-label={t("search.locateBookmark", {
                    name: suggestion.bookmark.title,
                  })}
                  title={t("search.locateBookmark", {
                    name: suggestion.bookmark.title,
                  })}
                  onClick={() => onLocateBookmark(suggestion.bookmark.id)}
                >
                  <LocateFixed aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            );
          }

          return (
            <button
              ref={
                isActive
                  ? (element) => {
                      activeItemRef.current = element;
                    }
                  : undefined
              }
              key={suggestionKey}
              id={getSearchSuggestionId(suggestion)}
              className={className}
              type="button"
              role="option"
              aria-selected={isActive}
              data-active={isActive ? "true" : undefined}
              onClick={() => onAccept(suggestion)}
            >
              {rowChrome}
              {content}
            </button>
          );
        })}
      </Popover.Content>
    </Popover.Portal>
  );
}
