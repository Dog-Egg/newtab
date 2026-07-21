import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { Search } from "lucide-react";
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

function getShortcutDomain(url: string) {
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
}: {
  suggestions: SearchSuggestionItem[];
  activeSuggestionKey: string | null;
  onAccept: (suggestion: SearchSuggestionItem) => void;
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
        className="glass-panel z-20 max-h-[min(50rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-b-glass rounded-t-none border-t-0 border-white/95 bg-slate-100 p-1.5 pt-2 shadow-[0_22px_58px_rgba(15,23,42,0.32)]"
        side="bottom"
        align="start"
        sideOffset={-1}
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
            : suggestion.shortcut.title;
          const url = isEngine
            ? getSearchEngineIconSource(suggestion.engine.urlFormat)
            : suggestion.shortcut.url;
          const domain = isEngine
            ? getSearchEngineDomain(suggestion.engine)
            : getShortcutDomain(suggestion.shortcut.url);
          const engineActionText = isEngine
            ? t("search.useEngine", { name: suggestion.engine.name })
            : "";

          const className = clsx(
            "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-slate-700 outline-none transition-colors hover:bg-slate-200/80 hover:text-slate-950 motion-reduce:transition-none",
            isActive &&
              "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80",
          );
          const content = (
            <>
              <SiteIcon
                title={title}
                url={url}
                seed={suggestionKey}
                format="png"
                className="size-7 rounded-full text-[12px] font-black shadow-sm"
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
                  <span
                    className={clsx(
                      "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                      isActive
                        ? "border-blue-600/20 bg-blue-600/10 text-blue-700"
                        : "border-slate-300 bg-white/60 text-slate-700",
                    )}
                  >
                    <Search aria-hidden="true" className="size-4" />
                    {engineActionText}
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <HighlightedText
                      text={suggestion.shortcut.title}
                      matches={suggestion.matches.title}
                    />
                  </span>
                  <span className="max-w-[45%] shrink-0 truncate text-sm text-slate-500">
                    <HighlightedText
                      text={domain ?? ""}
                      matches={suggestion.matches.domain}
                    />
                  </span>
                </>
              )}
            </>
          );

          if (!isEngine) {
            return (
              <a
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
                href={suggestion.shortcut.url}
                target="_parent"
                rel="noreferrer"
                role="option"
                aria-selected={isActive}
              >
                {content}
              </a>
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
              onClick={() => onAccept(suggestion)}
            >
              {content}
            </button>
          );
        })}
      </Popover.Content>
    </Popover.Portal>
  );
}
