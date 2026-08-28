import {
  handleContextMenuClick,
  refreshContextMenus,
  shouldRefreshContextMenus,
} from "./contextMenus";
import { migrateShortcutsAfterExtensionUpdate } from "../migrations/shortcuts";

chrome.runtime.onInstalled.addListener(refreshContextMenus);
chrome.runtime.onInstalled.addListener((details) => {
  void migrateShortcutsAfterExtensionUpdate(details).catch((error) => {
    console.error("Failed to migrate legacy shortcuts", error);
  });
});
chrome.runtime.onStartup.addListener(refreshContextMenus);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (shouldRefreshContextMenus(changes, areaName)) {
    refreshContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
