import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { platform } from "@platform";
import { App } from "./App";
import { BookmarkNavigationProvider } from "./Launcher/BookmarkNavigationProvider";
import { BookmarkProvider } from "./Launcher/BookmarkProvider";
import { SettingsProvider } from "./Settings/SettingsProvider";
import i18n from "./i18n";
import "./styles.css";

async function main() {
  // Resolve persisted settings before React's first render so neither the UI
  // nor the language selector briefly uses the browser default when the user
  // has explicitly chosen another language. Missing locale values still fall
  // back to the platform default (the browser UI language in extension mode).
  const initialSettings = await platform.settings.read();

  document.documentElement.lang = initialSettings.locale;
  try {
    await i18n.changeLanguage(initialSettings.locale);
  } catch (error: unknown) {
    console.error("Failed to apply the initial locale", error);
  }

  // Extension 首次读取书签树时会先完成旧 Launcher 的一次性导出。
  const initialBookmarks = await platform.bookmarks
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read browser bookmarks", error);
      return [];
    });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <SettingsProvider initialSettings={initialSettings}>
        <BookmarkProvider initialBookmarks={initialBookmarks}>
          <BookmarkNavigationProvider>
            <App />
          </BookmarkNavigationProvider>
        </BookmarkProvider>
      </SettingsProvider>
    </StrictMode>,
  );
}

void main();
