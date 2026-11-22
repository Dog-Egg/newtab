import type { Platform } from "./types";

export function getChromeStorage(key: string) {
  return new Promise<unknown>((resolve, reject) => {
    chrome.storage.local.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items[key]);
    });
  });
}

export function setChromeStorage(key: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function subscribeChromeStorage(
  key: string,
  onChange: (value: unknown) => void,
) {
  const handleStorageChange = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName === "local" && changes[key]) {
      onChange(changes[key].newValue);
    }
  };
  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => chrome.storage.onChanged.removeListener(handleStorageChange);
}

export const chromeLocalStorage: Platform["localStorage"] = {
  read: getChromeStorage,
  write: setChromeStorage,
  subscribe: subscribeChromeStorage,
};
