import type { BrowserBookmarkItem } from "../Launcher/bookmarkTree";
import {
  getSearchEngineMatches,
  type SearchEngine,
  type SearchEngineMatches,
  type TextMatch,
} from "./searchEngineUtils";

const MAX_SEARCH_SUGGESTIONS = 8;

export type SearchSuggestion =
  | { type: "engine"; engine: SearchEngine; matches: SearchEngineMatches }
  | {
      type: "bookmark";
      bookmark: BrowserBookmarkItem;
      matches: { title: TextMatch[]; domain: TextMatch[] };
    };

export function getSearchSuggestionKey(suggestion: SearchSuggestion) {
  return suggestion.type === "engine"
    ? `engine:${suggestion.engine.id}`
    : `bookmark:${suggestion.bookmark.id}`;
}

function getBookmarkUrlMatchCandidates(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");
    const hostnameParts = hostname.split(".");
    let hostnamePartStart = 0;

    return [
      {
        value: `${hostname}${parsedUrl.pathname}${parsedUrl.search}`
          .toLowerCase()
          .replace(/\/$/, ""),
        domainStart: 0,
        domainLength: hostname.length,
      },
      ...hostnameParts.slice(0, -1).map((part) => {
        const candidate = {
          value: part,
          domainStart: hostnamePartStart,
          domainLength: part.length,
        };
        hostnamePartStart += part.length + 1;
        return candidate;
      }),
    ];
  } catch {
    const lowerUrl = url.toLowerCase();
    const normalizedUrl = url
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
    const hostname = normalizedUrl.split(/[/?#]/, 1)[0];
    const normalizedUrlStart = Math.max(lowerUrl.indexOf(normalizedUrl), 0);
    let hostnamePartStart = 0;

    return [
      {
        value: normalizedUrl,
        domainStart: normalizedUrlStart,
        domainLength: hostname.length,
      },
      ...hostname
        .split(".")
        .slice(0, -1)
        .map((part) => {
          const candidate = {
            value: part,
            domainStart: normalizedUrlStart + hostnamePartStart,
            domainLength: part.length,
          };
          hostnamePartStart += part.length + 1;
          return candidate;
        }),
    ];
  }
}

function findBookmarks(bookmarks: BrowserBookmarkItem[], input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return [];

  const urlPrefix = value
    .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
    .replace(/^www\./, "");
  const seenBookmarkIds = new Set<string>();

  return bookmarks
    .flatMap((bookmark) => {
      if (seenBookmarkIds.has(bookmark.id)) return [];

      const trimmedTitle = bookmark.title.trim();
      const titleMatchIndex = trimmedTitle.toLowerCase().indexOf(value);
      const titleStart = bookmark.title.indexOf(trimmedTitle);
      const urlMatch = getBookmarkUrlMatchCandidates(bookmark.url).find(
        (candidate) => candidate.value.startsWith(urlPrefix),
      );
      if (titleMatchIndex < 0 && !urlMatch) return [];

      seenBookmarkIds.add(bookmark.id);
      return [
        {
          bookmark,
          matchIndex: Math.max(titleMatchIndex, 0),
          matches: {
            title:
              titleMatchIndex >= 0
                ? [
                    {
                      start: titleStart + titleMatchIndex,
                      length: value.length,
                    },
                  ]
                : [],
            domain: urlMatch
              ? [
                  {
                    start: urlMatch.domainStart,
                    length: Math.min(urlPrefix.length, urlMatch.domainLength),
                  },
                ]
              : [],
          },
        },
      ];
    })
    .sort((left, right) => left.matchIndex - right.matchIndex)
    .map(({ bookmark, matches }) => ({ bookmark, matches }));
}

export function findSearchSuggestions({
  engines,
  bookmarks,
  input,
  selectedEngineId,
  temporaryEngineId,
}: {
  engines: SearchEngine[];
  bookmarks: BrowserBookmarkItem[];
  input: string;
  selectedEngineId: string;
  temporaryEngineId: string | null;
}): SearchSuggestion[] {
  const engineSuggestions: SearchSuggestion[] = engines.flatMap((engine) => {
    const matches = getSearchEngineMatches(engine, input);
    if (
      !matches ||
      (engine.id === selectedEngineId && engine.id !== temporaryEngineId)
    ) {
      return [];
    }

    return [{ type: "engine" as const, engine, matches }];
  });
  const bookmarkSuggestions: SearchSuggestion[] = findBookmarks(
    bookmarks,
    input,
  ).map(({ bookmark, matches }) => ({
    type: "bookmark",
    bookmark,
    matches,
  }));

  return [...engineSuggestions, ...bookmarkSuggestions].slice(
    0,
    MAX_SEARCH_SUGGESTIONS,
  );
}
