import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./schema";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(() => Promise.resolve()),
  subscribe: vi.fn(),
  changeLanguage: vi.fn(() => Promise.resolve()),
}));

vi.mock("@platform", () => ({
  platform: { defaultLocale: "en", preferencesStorage: mocks },
}));

vi.mock("../../i18n", () => ({
  default: { changeLanguage: mocks.changeLanguage },
}));

const settings: Settings = {
  locale: "en",
  nodeScale: 1,
};

async function loadStore(initialSettings = settings) {
  mocks.read.mockResolvedValue(initialSettings);
  return import("./store");
}

beforeEach(() => {
  vi.resetModules();
  mocks.read.mockReset();
  mocks.write.mockReset();
  mocks.subscribe.mockReset();
  mocks.changeLanguage.mockReset();
  mocks.write.mockResolvedValue(undefined);
  mocks.subscribe.mockReturnValue(vi.fn());
  mocks.changeLanguage.mockResolvedValue(undefined);
});

describe("settings store", () => {
  it("initializes from storage, then updates and persists settings", async () => {
    const { useSettingsStore } = await loadStore();

    useSettingsStore.getState().updateSettings({ nodeScale: 1.2 });

    expect(mocks.read).toHaveBeenCalledExactlyOnceWith("settings");
    expect(mocks.changeLanguage).toHaveBeenCalledWith("en");
    expect(useSettingsStore.getState().nodeScale).toBe(1.2);
    expect(mocks.write).toHaveBeenCalledWith("settings", {
      ...settings,
      nodeScale: 1.2,
    });
  });

  it("applies storage changes without saving them again", async () => {
    let onChange: ((value: unknown) => void) | undefined;
    mocks.subscribe.mockImplementation(
      (key: string, callback: (value: unknown) => void) => {
        expect(key).toBe("settings");
        onChange = callback;
        return vi.fn();
      },
    );
    const { useSettingsStore } = await loadStore();

    onChange?.({ ...settings, nodeScale: 1.2 });

    expect(useSettingsStore.getState().nodeScale).toBe(1.2);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("preserves an unset locale while applying the platform default", async () => {
    const persistedSettings = { ...settings, locale: undefined };
    const { useSettingsStore } = await loadStore(persistedSettings);

    useSettingsStore.getState().updateSettings({ nodeScale: 1.2 });

    expect(useSettingsStore.getState().locale).toBeUndefined();
    expect(mocks.changeLanguage).toHaveBeenCalledWith("en");
    expect(mocks.write).toHaveBeenCalledWith("settings", {
      ...persistedSettings,
      nodeScale: 1.2,
    });
  });
});
