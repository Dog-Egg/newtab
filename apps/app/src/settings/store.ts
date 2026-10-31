import { create } from "zustand";
import { platform } from "@platform";
import i18n from "../i18n";
import type { Settings } from "./schema";

type SettingsUpdate =
  Partial<Settings> | ((settings: Settings) => Partial<Settings>);

type SettingsStore = Settings & {
  updateSettings: (update: SettingsUpdate) => void;
};

function getSettings({
  locale,
  wallpaperUrl,
  wallpaperColor,
  nodeScale,
  wallpaperOverlayOpacity,
}: SettingsStore): Settings {
  return {
    locale,
    wallpaperUrl,
    wallpaperColor,
    nodeScale,
    wallpaperOverlayOpacity,
  };
}

function getNextSettings(current: Settings, update: SettingsUpdate): Settings {
  const patch = typeof update === "function" ? update(current) : update;
  return { ...current, ...patch };
}

async function applyLocale(locale: Settings["locale"]) {
  const resolvedLocale = locale ?? platform.defaultLocale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = resolvedLocale;
  }
  try {
    await i18n.changeLanguage(resolvedLocale);
  } catch (error: unknown) {
    console.error("Failed to apply locale", error);
  }
}

async function createSettingsStore() {
  const initialSettings = await platform.settings.read();
  await applyLocale(initialSettings.locale);

  const store = create<SettingsStore>()((set, get) => {
    const applySettingsUpdate = (update: SettingsUpdate) => {
      const current = getSettings(get());
      const next = getNextSettings(current, update);

      if (next.locale !== current.locale) void applyLocale(next.locale);
      set(next);
      return next;
    };

    return {
      ...initialSettings,
      updateSettings: (update) => {
        const next = applySettingsUpdate(update);
        void platform.settings.save(next).catch((error: unknown) => {
          console.error("Failed to save settings", error);
        });
      },
    };
  });

  platform.settings.subscribe((settings) => {
    const current = getSettings(store.getState());
    if (settings.locale !== current.locale) void applyLocale(settings.locale);
    store.setState(settings);
  });

  return store;
}

export const useSettingsStore = await createSettingsStore();
