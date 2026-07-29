import { getLocaleFromLanguage } from "../../i18n/locale";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
} from "../../Settings/settings";
import { createRefreshScheduler } from "../contextMenuRefresh";
import { getLocalStorage, removeAllContextMenus } from "./chrome";
import {
  createSelectedTextSearchMenu,
  handleSelectedTextSearchMenuClick,
  SELECTED_TEXT_SEARCH_MENU_STORAGE_KEYS,
} from "./selectedTextSearchMenu";

const CONTEXT_MENU_STORAGE_KEYS = [
  SETTINGS_STORAGE_KEY,
  ...SELECTED_TEXT_SEARCH_MENU_STORAGE_KEYS,
];
const defaultLocale = getLocaleFromLanguage(chrome.i18n.getUILanguage());

async function rebuildContextMenus() {
  const items = await getLocalStorage(CONTEXT_MENU_STORAGE_KEYS);
  const { locale } = normalizeSettings(
    items[SETTINGS_STORAGE_KEY],
    defaultLocale,
  );

  await removeAllContextMenus();
  await createSelectedTextSearchMenu(items, locale);
}

export const refreshContextMenus = createRefreshScheduler(
  rebuildContextMenus,
  (error) => {
    console.error("Failed to refresh context menu", error);
  },
);

export function shouldRefreshContextMenus(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) {
  return (
    areaName === "local" &&
    CONTEXT_MENU_STORAGE_KEYS.some((key) => changes[key])
  );
}

export function handleContextMenuClick(info: chrome.contextMenus.OnClickData) {
  handleSelectedTextSearchMenuClick(info);
}
