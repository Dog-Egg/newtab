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

export function normalizeCustomEngines(
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

function getDomainFromInput(input: string) {
  const value = input.trim().toLowerCase();
  if (!value || /\s/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

export function findSearchEngines(engines: SearchEngine[], input: string) {
  return engines.filter((engine) => getSearchEngineMatches(engine, input));
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

export function findSearchEngineByDomain(
  engines: SearchEngine[],
  input: string,
) {
  const domain = getDomainFromInput(input);
  if (!domain || !domain.includes(".")) return null;

  return (
    findSearchEngines(engines, input).find(
      (engine) => getSearchEngineDomain(engine) === domain,
    ) ?? null
  );
}
