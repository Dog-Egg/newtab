import type { ShortcutCategory, ShortcutItem } from "../Launcher/launcher";
import { findSearchEngines, type SearchEngine } from "./searchEngineUtils";

const MAX_SEARCH_SUGGESTIONS = 8;

export type SearchSuggestion =
  | { type: "engine"; engine: SearchEngine }
  | { type: "shortcut"; shortcut: ShortcutItem };

export function getSearchSuggestionKey(suggestion: SearchSuggestion) {
  return suggestion.type === "engine"
    ? `engine:${suggestion.engine.id}`
    : `shortcut:${suggestion.shortcut.id}`;
}

function getShortcutUrlMatchValue(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");
    return `${hostname}${parsedUrl.pathname}${parsedUrl.search}`
      .toLowerCase()
      .replace(/\/$/, "");
  } catch {
    return url
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
  }
}

function findShortcuts(categories: ShortcutCategory[], input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return [];

  const urlPrefix = value
    .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
    .replace(/^www\./, "");
  const seenShortcutIds = new Set<string>();

  return categories.flatMap((category) =>
    category.shortcuts.flatMap((node) => {
      const shortcuts = node.type === "folder" ? node.children : [node];

      return shortcuts.filter((shortcut) => {
        if (seenShortcutIds.has(shortcut.id)) return false;

        const matches =
          shortcut.title.trim().toLowerCase().startsWith(value) ||
          getShortcutUrlMatchValue(shortcut.url).startsWith(urlPrefix);
        if (matches) seenShortcutIds.add(shortcut.id);
        return matches;
      });
    }),
  );
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
  const engineSuggestions: SearchSuggestion[] = findSearchEngines(
    engines,
    input,
  )
    .filter(
      (engine) =>
        engine.id !== selectedEngineId || engine.id === temporaryEngineId,
    )
    .map((engine) => ({ type: "engine", engine }));
  const shortcutSuggestions: SearchSuggestion[] = findShortcuts(
    categories,
    input,
  ).map((shortcut) => ({ type: "shortcut", shortcut }));

  return [...engineSuggestions, ...shortcutSuggestions].slice(
    0,
    MAX_SEARCH_SUGGESTIONS,
  );
}
