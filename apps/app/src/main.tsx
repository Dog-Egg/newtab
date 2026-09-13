import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { platform } from "@platform";
import { App } from "./App";
import { BookmarkNavigationProvider } from "./Launcher/BookmarkNavigationProvider";
import { BookmarkProvider } from "./Launcher/BookmarkProvider";
import "./styles.css";

async function main() {
  // Extension 首次读取书签树时会先完成旧 Launcher 的一次性导出。
  const initialBookmarks = await platform.bookmarks
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read browser bookmarks", error);
      return [];
    });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BookmarkProvider initialBookmarks={initialBookmarks}>
        <BookmarkNavigationProvider>
          <App />
        </BookmarkNavigationProvider>
      </BookmarkProvider>
    </StrictMode>,
  );
}

void main();
