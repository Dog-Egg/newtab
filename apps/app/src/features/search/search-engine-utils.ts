import type {
  SearchEngine,
  StoredSearchEngineSettings,
  UrlSearchEngine,
} from "./schema";
import { BROWSER_DEFAULT_ENGINE_ID, customEngineDraftSchema } from "./schema";

export type TextMatch = {
  start: number;
  length: number;
};

export type SearchEngineMatches = {
  name: TextMatch[];
  domain: TextMatch[];
};

export const BROWSER_DEFAULT_ENGINE: SearchEngine = {
  kind: "browser",
  id: BROWSER_DEFAULT_ENGINE_ID,
  name: "Browser default search engine",
};

export const PRESET_SEARCH_ENGINES: UrlSearchEngine[] = [
  {
    kind: "url",
    id: "google",
    name: "Google",
    urlFormat: "https://www.google.com/search?q=%s",
  },
  {
    kind: "url",
    id: "bing",
    name: "Bing",
    urlFormat: "https://www.bing.com/search?q=%s",
  },
];

export function getAvailableSearchEngines(
  settings: Pick<
    StoredSearchEngineSettings,
    "hiddenDefaultEngineIds" | "customEngines"
  >,
  includeBrowserDefault = true,
): SearchEngine[] {
  const customEngines = settings.customEngines ?? [];
  const customEngineById = new Map(
    customEngines.map((engine) => [engine.id, engine]),
  );
  const presetEngineIds = new Set(
    PRESET_SEARCH_ENGINES.map((engine) => engine.id),
  );
  const visiblePresetEngines = PRESET_SEARCH_ENGINES.filter(
    (engine) => !settings.hiddenDefaultEngineIds?.includes(engine.id),
  ).map((engine) => customEngineById.get(engine.id) ?? engine);
  const addedEngines = customEngines.filter(
    (engine) => !presetEngineIds.has(engine.id),
  );

  const engines: SearchEngine[] = [
    ...(includeBrowserDefault ? [BROWSER_DEFAULT_ENGINE] : []),
    ...visiblePresetEngines.map((engine) => ({
      ...engine,
      kind: "url" as const,
    })),
    ...addedEngines
      .filter((engine) => engine.id !== BROWSER_DEFAULT_ENGINE_ID)
      .map((engine) => ({ ...engine, kind: "url" as const })),
  ];
  return engines.length > 0 ? engines : [PRESET_SEARCH_ENGINES[0]];
}

export function buildSearchUrl(urlFormat: string, query: string) {
  const encodedQuery = encodeURIComponent(query);

  if (urlFormat.includes("%s")) {
    return urlFormat.split("%s").join(encodedQuery);
  }

  const url = new URL(urlFormat);
  url.searchParams.set("q", query);
  return url.href;
}

export function createCustomEngineId() {
  return `custom-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getSearchEngineIconSource(urlFormat?: string) {
  return urlFormat?.split("%s").join("") ?? "";
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function getSearchEngineDomain(engine: SearchEngine) {
  if (engine.kind === "browser") return null;
  try {
    return normalizeHostname(
      new URL(getSearchEngineIconSource(engine.urlFormat)).hostname,
    );
  } catch {
    return null;
  }
}

export function getSearchEngineMatches(
  engine: SearchEngine,
  input: string,
): SearchEngineMatches | null {
  const value = input.trim().toLowerCase();
  if (!value || /\s/.test(value)) return null;

  const domainPrefix = value
    .replace(/^[a-z][a-z\d+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  const domain = getSearchEngineDomain(engine);
  const matches: SearchEngineMatches = {
    name: engine.name.toLowerCase().startsWith(value)
      ? [{ start: 0, length: value.length }]
      : [],
    domain: domain?.startsWith(domainPrefix)
      ? [{ start: 0, length: domainPrefix.length }]
      : [],
  };

  return matches.name.length > 0 || matches.domain.length > 0 ? matches : null;
}

export async function submitSearch(
  engine: SearchEngine,
  text: string,
  search: { browserSearch?: (text: string) => Promise<void> },
) {
  const query = text.trim();
  if (!query) return;
  if (engine.kind === "browser") {
    if (!search.browserSearch) throw new Error("Browser search is unavailable");
    await search.browserSearch(query);
  } else {
    if (!customEngineDraftSchema.safeParse(engine).success)
      throw new InvalidSearchEngineUrlError();
    window.open(
      buildSearchUrl(engine.urlFormat, query),
      "_parent",
      "noreferrer",
    );
  }
}

export class InvalidSearchEngineUrlError extends Error {
  constructor() {
    super("Invalid search engine URL");
  }
}
