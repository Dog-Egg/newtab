export function getChromeStorage<T>(
  key: string,
  normalize: (value: unknown) => T,
) {
  return new Promise<T>((resolve, reject) => {
    chrome.storage.local.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(normalize(items[key]));
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
