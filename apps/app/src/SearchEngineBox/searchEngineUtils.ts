import type { StoredSearchEngineSettings } from "../platform/types";

export type SearchEngine = {
  id: string;
  name: string;
  urlFormat: string;
};

export type TextMatch = {
  start: number;
  length: number;
};

export type SearchEngineMatches = {
  name: TextMatch[];
  domain: TextMatch[];
};

export type CustomEngineDraft = {
  name: string;
  urlFormat: string;
};

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "google",
    name: "Google",
    urlFormat: "https://www.google.com/search?q=%s",
  },
  {
    id: "bing",
    name: "Bing",
    urlFormat: "https://www.bing.com/search?q=%s",
  },
];

export const EMPTY_CUSTOM_ENGINE: CustomEngineDraft = {
  name: "",
  urlFormat: "",
};

function normalizeCustomEngines(
  customEngines: StoredSearchEngineSettings["customEngines"],
): SearchEngine[] {
  if (!Array.isArray(customEngines)) {
    return [];
  }

  return customEngines.flatMap((engine) => {
    const name = engine.name?.trim();
    const urlFormat = engine.urlFormat?.trim();

    if (!engine.id || !name || !urlFormat) {
      return [];
    }

    return [{ id: engine.id, name, urlFormat }];
  });
}

export function getAvailableSearchEngines(
  settings: StoredSearchEngineSettings,
): SearchEngine[] {
  const customEngines = normalizeCustomEngines(settings.customEngines);
  const customEngineById = new Map(
    customEngines.map((engine) => [engine.id, engine]),
  );
  const defaultEngineIds = new Set(
    DEFAULT_SEARCH_ENGINES.map((engine) => engine.id),
  );
  const visibleDefaultEngines = DEFAULT_SEARCH_ENGINES.filter(
    (engine) => !settings.hiddenDefaultEngineIds?.includes(engine.id),
  ).map((engine) => customEngineById.get(engine.id) ?? engine);
  const addedEngines = customEngines.filter(
    (engine) => !defaultEngineIds.has(engine.id),
  );

  return [...visibleDefaultEngines, ...addedEngines];
}

export function buildSearchUrl(urlFormat: string, query: string) {
  const encodedQuery = encodeURIComponent(query);

  if (urlFormat.includes("%s")) {
    return urlFormat.split("%s").join(encodedQuery);
  }

  const separator = urlFormat.includes("?") ? "&" : "?";
  return `${urlFormat}${separator}q=${encodedQuery}`;
}

export function createCustomEngineId() {
  return `custom-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getSearchEngineIconSource(urlFormat: string) {
  return urlFormat.split("%s").join("");
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function getSearchEngineDomain(engine: SearchEngine) {
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
