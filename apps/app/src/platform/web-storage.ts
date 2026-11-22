function parseStorageValue(saved: string | null): unknown {
  if (saved === null) return undefined;
  try {
    return JSON.parse(saved);
  } catch {
    return saved;
  }
}

function createWebStorage(getStorage: () => Storage) {
  return {
    read: (key: string) => parseStorageValue(getStorage().getItem(key)),
    write: (key: string, value: unknown) => {
      getStorage().setItem(key, JSON.stringify(value));
    },
    subscribe: (key: string, onChange: (value: unknown) => void) => {
      const handleStorageChange = (event: StorageEvent) => {
        const storage = getStorage();
        if (
          event.storageArea === storage &&
          (event.key === key || event.key === null)
        ) {
          onChange(parseStorageValue(storage.getItem(key)));
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  };
}

export const webSessionStorage = createWebStorage(() => window.sessionStorage);
export const webLocalStorage = createWebStorage(() => window.localStorage);
