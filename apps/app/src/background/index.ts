import {
  handleContextMenuClick,
  refreshContextMenus,
  shouldRefreshContextMenus,
} from "./context-menus";
import { registerBookmarkUsage } from "./bookmark-usage";

registerBookmarkUsage();

chrome.runtime.onInstalled.addListener(refreshContextMenus);
chrome.runtime.onStartup.addListener(refreshContextMenus);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (shouldRefreshContextMenus(changes, areaName)) {
    refreshContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
