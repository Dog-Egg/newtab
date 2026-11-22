import {
  searchEngineSettingsSchema,
  type StoredSearchEngineSettings,
} from "./schema";

export const SEARCH_ENGINE_SETTINGS_KEY = "search-engine-settings";

export async function readSearchEngineSettings(
  read: (key: string) => Promise<unknown>,
) {
  return searchEngineSettingsSchema.parse(
    await read(SEARCH_ENGINE_SETTINGS_KEY),
  );
}

export function writeSearchEngineSettings(
  write: (key: string, value: unknown) => Promise<void>,
  settings: StoredSearchEngineSettings,
) {
  return write(SEARCH_ENGINE_SETTINGS_KEY, settings);
}
