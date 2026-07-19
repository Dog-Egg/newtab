import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { platform } from "@platform";
import { App } from "./App";
import { LauncherProvider } from "./Launcher/LauncherProvider";
import { SettingsProvider } from "./Settings/SettingsProvider";
import { normalizeSettings } from "./Settings/settings";
import i18n from "./i18n";
import "./styles.css";

async function main() {
  // Resolve persisted settings before React's first render so neither the UI
  // nor the language selector briefly uses the browser default when the user
  // has explicitly chosen another language. Missing locale values still fall
  // back to the platform default (the browser UI language in extension mode).
  const initialSettings = await platform.settings
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read initial settings", error);
      return normalizeSettings(undefined, platform.defaultLocale);
    });

  document.documentElement.lang = initialSettings.locale;
  try {
    await i18n.changeLanguage(initialSettings.locale);
  } catch (error: unknown) {
    console.error("Failed to apply the initial locale", error);
  }

  const initialLauncherCategories = await platform.launcher
    .read(initialSettings.locale)
    .catch((error: unknown) => {
      console.error("Failed to read initial launcher", error);
      return [];
    });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <SettingsProvider initialSettings={initialSettings}>
        <LauncherProvider initialCategories={initialLauncherCategories}>
          <App />
        </LauncherProvider>
      </SettingsProvider>
    </StrictMode>,
  );
}

void main();
