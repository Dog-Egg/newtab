import {
  buildSearchUrl,
  getAvailableSearchEngines,
} from "../../SearchEngineBox/searchEngineUtils";
import type { AppLocale } from "../../i18n/locale";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type StoredSearchEngineSettings,
} from "../../platform/types";
import { createContextMenuItem, getLocalStorage } from "./chrome";

const SEARCH_MENU_ID = "search-selected-text";
const SEARCH_ENGINE_MENU_ID_PREFIX = `${SEARCH_MENU_ID}:engine:`;

export const SELECTED_TEXT_SEARCH_MENU_STORAGE_KEYS = [
  SEARCH_ENGINE_SETTINGS_KEY,
] as const;

function normalizeSearchEngineSettings(
  value: unknown,
): StoredSearchEngineSettings {
  return value && typeof value === "object"
    ? (value as StoredSearchEngineSettings)
    : {};
}

export async function createSelectedTextSearchMenu(
  items: Record<string, unknown>,
  locale: AppLocale,
) {
  const searchEngines = getAvailableSearchEngines(
    normalizeSearchEngineSettings(items[SEARCH_ENGINE_SETTINGS_KEY]),
  );
  if (searchEngines.length === 0) return;

  await createContextMenuItem({
    id: SEARCH_MENU_ID,
    title: locale === "zh-CN" ? "搜索“%s”" : 'Search "%s"',
    contexts: ["selection"],
  });

  for (const engine of searchEngines) {
    await createContextMenuItem({
      id: `${SEARCH_ENGINE_MENU_ID_PREFIX}${encodeURIComponent(engine.id)}`,
      parentId: SEARCH_MENU_ID,
      title: engine.name,
      contexts: ["selection"],
    });
  }
}

async function searchSelectedText(engineId: string, selectionText: string) {
  const items = await getLocalStorage([SEARCH_ENGINE_SETTINGS_KEY]);
  const engine = getAvailableSearchEngines(
    normalizeSearchEngineSettings(items[SEARCH_ENGINE_SETTINGS_KEY]),
  ).find((candidate) => candidate.id === engineId);
  const query = selectionText.trim();
  if (!engine || !query) return;

  await chrome.tabs.create({
    url: buildSearchUrl(engine.urlFormat, query),
  });
}

export function handleSelectedTextSearchMenuClick(
  info: chrome.contextMenus.OnClickData,
) {
  const menuItemId = String(info.menuItemId);
  if (!menuItemId.startsWith(SEARCH_ENGINE_MENU_ID_PREFIX)) {
    return false;
  }

  if (info.selectionText) {
    const engineId = decodeURIComponent(
      menuItemId.slice(SEARCH_ENGINE_MENU_ID_PREFIX.length),
    );
    void searchSelectedText(engineId, info.selectionText).catch(console.error);
  }

  return true;
}
