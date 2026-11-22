import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "../settings/schema";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(() => Promise.resolve()),
  subscribe: vi.fn(),
  changeLanguage: vi.fn(() => Promise.resolve()),
}));

vi.mock("@platform", () => ({
  platform: { defaultLocale: "en", settings: mocks },
}));

vi.mock("../i18n", () => ({
  default: { changeLanguage: mocks.changeLanguage },
}));

const settings: Settings = {
  locale: "en",
  nodeScale: 1,
};

async function loadStore(initialSettings = settings) {
  mocks.read.mockResolvedValue(initialSettings);
  return import("./settings");
}

beforeEach(() => {
  vi.resetModules();
  mocks.read.mockReset();
  mocks.save.mockReset();
  mocks.subscribe.mockReset();
  mocks.changeLanguage.mockReset();
  mocks.save.mockResolvedValue(undefined);
  mocks.subscribe.mockReturnValue(vi.fn());
  mocks.changeLanguage.mockResolvedValue(undefined);
});

describe("settings store", () => {
  it("initializes from storage, then updates and persists settings", async () => {
    const { useSettingsStore } = await loadStore();

    useSettingsStore.getState().updateSettings({ nodeScale: 1.2 });

    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.changeLanguage).toHaveBeenCalledWith("en");
    expect(useSettingsStore.getState().nodeScale).toBe(1.2);
    expect(mocks.save).toHaveBeenCalledWith({ ...settings, nodeScale: 1.2 });
  });

  it("applies storage changes without saving them again", async () => {
    let onChange: ((nextSettings: Settings) => void) | undefined;
    mocks.subscribe.mockImplementation(
      (callback: (nextSettings: Settings) => void) => {
        onChange = callback;
        return vi.fn();
      },
    );
    const { useSettingsStore } = await loadStore();

    onChange?.({ ...settings, nodeScale: 1.2 });

    expect(useSettingsStore.getState().nodeScale).toBe(1.2);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("preserves an unset locale while applying the platform default", async () => {
    const persistedSettings = { ...settings, locale: undefined };
    const { useSettingsStore } = await loadStore(persistedSettings);

    useSettingsStore.getState().updateSettings({ nodeScale: 1.2 });

    expect(useSettingsStore.getState().locale).toBeUndefined();
    expect(mocks.changeLanguage).toHaveBeenCalledWith("en");
    expect(mocks.save).toHaveBeenCalledWith({
      ...persistedSettings,
      nodeScale: 1.2,
    });
  });
});
