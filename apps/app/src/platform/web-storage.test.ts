// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { webSessionStorage } from "./web-storage";

it("reads the current setting when an older storage event arrives", () => {
  const key = "settings";
  const current = { nodeScale: 1.1 };
  const onChange = vi.fn();
  const unsubscribe = webSessionStorage.subscribe(key, onChange);

  try {
    webSessionStorage.write(key, current);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: JSON.stringify({ nodeScale: 0.9 }),
        storageArea: window.sessionStorage,
      }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith(current);
  } finally {
    unsubscribe();
    window.sessionStorage.removeItem(key);
  }
});
