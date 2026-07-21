import type { ShortcutCategory, ShortcutItem } from "../Launcher/launcher";
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
      type: "shortcut";
      shortcut: ShortcutItem;
      matches: { title: TextMatch[]; domain: TextMatch[] };
    };

export function getSearchSuggestionKey(suggestion: SearchSuggestion) {
  return suggestion.type === "engine"
    ? `engine:${suggestion.engine.id}`
    : `shortcut:${suggestion.shortcut.id}`;
}

function getShortcutUrlMatchCandidates(url: string) {
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

function findShortcuts(categories: ShortcutCategory[], input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return [];

  const urlPrefix = value
    .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
    .replace(/^www\./, "");
  const seenShortcutIds = new Set<string>();

  return categories
    .flatMap((category) =>
      category.shortcuts.flatMap((node) => {
        const shortcuts = node.type === "folder" ? node.children : [node];

        return shortcuts.flatMap((shortcut) => {
          if (seenShortcutIds.has(shortcut.id)) return [];

          const trimmedTitle = shortcut.title.trim();
          const titleMatchIndex = trimmedTitle.toLowerCase().indexOf(value);
          const titleStart = shortcut.title.indexOf(trimmedTitle);
          const urlMatch = getShortcutUrlMatchCandidates(shortcut.url).find(
            (candidate) => candidate.value.startsWith(urlPrefix),
          );
          if (titleMatchIndex < 0 && !urlMatch) return [];

          seenShortcutIds.add(shortcut.id);
          return [
            {
              shortcut,
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
                        length: Math.min(
                          urlPrefix.length,
                          urlMatch.domainLength,
                        ),
                      },
                    ]
                  : [],
              },
            },
          ];
        });
      }),
    )
    .sort((left, right) => left.matchIndex - right.matchIndex)
    .map(({ shortcut, matches }) => ({ shortcut, matches }));
}

export function findSearchSuggestions({
  engines,
  categories,
  input,
  selectedEngineId,
  temporaryEngineId,
}: {
  engines: SearchEngine[];
  categories: ShortcutCategory[];
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
  const shortcutSuggestions: SearchSuggestion[] = findShortcuts(
    categories,
    input,
  ).map(({ shortcut, matches }) => ({
    type: "shortcut",
    shortcut,
    matches,
  }));

  return [...engineSuggestions, ...shortcutSuggestions].slice(
    0,
    MAX_SEARCH_SUGGESTIONS,
  );
}
