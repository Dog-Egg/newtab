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

  // Extension 首次读取布局时可能先把旧 Launcher 快捷方式导出为 Chrome
  // Bookmarks，因此实体必须在布局迁移完成后再读，避免首屏拿到迁移前的旧快照。
  const initialBookmarkLayout = await platform.bookmarkLayout
    .read(initialSettings.locale)
    .catch((error: unknown) => {
      console.error("Failed to read bookmark layout", error);
      return [];
    });
  const initialBookmarks = await platform.bookmarks
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read browser bookmarks", error);
      return [];
    });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <SettingsProvider initialSettings={initialSettings}>
        <LauncherProvider
          initialLayout={initialBookmarkLayout}
          initialBookmarks={initialBookmarks}
        >
          <App />
        </LauncherProvider>
      </SettingsProvider>
    </StrictMode>,
  );
}

void main();
