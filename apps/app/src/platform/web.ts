import {
  SHORTCUTS_STORAGE_KEY,
  type ShortcutNode,
  normalizeShortcuts,
} from "../shortcuts";
import {
  normalizeStoredWallpaperUrl,
  WALLPAPER_STORAGE_KEY,
} from "../wallpapers";
import type { Platform, StoredSearchEngineSettings } from "./types";
import {
  LAUNCHER_SETTINGS_STORAGE_KEY,
  normalizeLauncherSettings,
  type LauncherSettings,
} from "../launcherSettings";

const SEARCH_ENGINE_SETTINGS_KEY = "browser-tab.searchEngineSettings.v1";

let defaultShortcutOrder = 0;

function defaultShortcut(title: string, url: string) {
  return {
    type: "item" as const,
    id: url,
    title,
    url,
    createdAt: ++defaultShortcutOrder,
  };
}

function defaultFolder(
  id: string,
  title: string,
  children: ReturnType<typeof defaultShortcut>[],
) {
  return {
    type: "folder" as const,
    id: `folder-${id}`,
    title,
    children,
    createdAt: ++defaultShortcutOrder,
  };
}

const DEFAULT_SHORTCUTS: ShortcutNode[] = [
  defaultShortcut("YouTube", "https://www.youtube.com"),
  defaultShortcut("Wikipedia", "https://www.wikipedia.org"),
  defaultFolder("social", "Social", [
    defaultShortcut("Facebook", "https://www.facebook.com"),
    defaultShortcut("Instagram", "https://www.instagram.com"),
    defaultShortcut("X", "https://x.com"),
    defaultShortcut("LinkedIn", "https://www.linkedin.com"),
    defaultShortcut("TikTok", "https://www.tiktok.com"),
    defaultShortcut("Discord", "https://discord.com"),
  ]),
  defaultShortcut("Reddit", "https://www.reddit.com"),
  defaultShortcut("ChatGPT", "https://chatgpt.com"),
  defaultFolder("entertainment", "Entertainment", [
    defaultShortcut("Netflix", "https://www.netflix.com"),
    defaultShortcut("Spotify", "https://open.spotify.com"),
    defaultShortcut("Twitch", "https://www.twitch.tv"),
    defaultShortcut("Disney+", "https://www.disneyplus.com"),
    defaultShortcut("SoundCloud", "https://soundcloud.com"),
    defaultShortcut("IMDb", "https://www.imdb.com"),
  ]),
  defaultShortcut("GitHub", "https://github.com"),
  defaultShortcut("WhatsApp", "https://www.whatsapp.com"),
  defaultFolder("productivity", "Productivity", [
    defaultShortcut("Gmail", "https://mail.google.com"),
    defaultShortcut("Google Drive", "https://drive.google.com"),
    defaultShortcut("Notion", "https://www.notion.so"),
    defaultShortcut("Dropbox", "https://www.dropbox.com"),
    defaultShortcut("Canva", "https://www.canva.com"),
    defaultShortcut("Trello", "https://trello.com"),
  ]),
  defaultShortcut("Apple", "https://www.apple.com"),
  defaultFolder("development", "Development", [
    defaultShortcut("Stack Overflow", "https://stackoverflow.com"),
    defaultShortcut("MDN", "https://developer.mozilla.org"),
    defaultShortcut("CodePen", "https://codepen.io"),
    defaultShortcut("Vercel", "https://vercel.com"),
    defaultShortcut("npm", "https://www.npmjs.com"),
    defaultShortcut("Hugging Face", "https://huggingface.co"),
  ]),
  defaultShortcut("Pinterest", "https://www.pinterest.com"),
  defaultShortcut("Medium", "https://medium.com"),
  defaultFolder("shopping", "Shopping", [
    defaultShortcut("Amazon", "https://www.amazon.com"),
    defaultShortcut("eBay", "https://www.ebay.com"),
    defaultShortcut("Etsy", "https://www.etsy.com"),
    defaultShortcut("AliExpress", "https://www.aliexpress.com"),
    defaultShortcut("IKEA", "https://www.ikea.com"),
    defaultShortcut("Nike", "https://www.nike.com"),
  ]),
  defaultShortcut("Zoom", "https://zoom.us"),
  defaultShortcut("Quora", "https://www.quora.com"),
  defaultFolder("travel", "Travel", [
    defaultShortcut("Booking.com", "https://www.booking.com"),
    defaultShortcut("Airbnb", "https://www.airbnb.com"),
    defaultShortcut("Tripadvisor", "https://www.tripadvisor.com"),
    defaultShortcut("Skyscanner", "https://www.skyscanner.com"),
    defaultShortcut("Google Maps", "https://www.google.com/maps"),
    defaultShortcut("Expedia", "https://www.expedia.com"),
  ]),
  defaultShortcut("Telegram", "https://telegram.org"),
  defaultShortcut("Proton", "https://proton.me"),
  defaultFolder("news", "News", [
    defaultShortcut("BBC", "https://www.bbc.com"),
    defaultShortcut("CNN", "https://www.cnn.com"),
    defaultShortcut("Reuters", "https://www.reuters.com"),
    defaultShortcut("AP News", "https://apnews.com"),
    defaultShortcut("The Guardian", "https://www.theguardian.com"),
    defaultShortcut("The New York Times", "https://www.nytimes.com"),
  ]),
  defaultShortcut("Figma", "https://www.figma.com"),
  defaultShortcut("Behance", "https://www.behance.net"),
  defaultFolder("learning", "Learning", [
    defaultShortcut("Coursera", "https://www.coursera.org"),
    defaultShortcut("Khan Academy", "https://www.khanacademy.org"),
    defaultShortcut("Udemy", "https://www.udemy.com"),
    defaultShortcut("Duolingo", "https://www.duolingo.com"),
    defaultShortcut("edX", "https://www.edx.org"),
    defaultShortcut("Internet Archive", "https://archive.org"),
  ]),
  defaultShortcut("PayPal", "https://www.paypal.com"),
  defaultShortcut("Coinbase", "https://www.coinbase.com"),
  defaultFolder("finance", "Finance", [
    defaultShortcut("Bloomberg", "https://www.bloomberg.com"),
    defaultShortcut("Forbes", "https://www.forbes.com"),
    defaultShortcut("Yahoo Finance", "https://finance.yahoo.com"),
    defaultShortcut("TradingView", "https://www.tradingview.com"),
    defaultShortcut("Wise", "https://wise.com"),
    defaultShortcut("Stripe", "https://stripe.com"),
  ]),
  defaultShortcut("Adobe", "https://www.adobe.com"),
  defaultShortcut("Dribbble", "https://dribbble.com"),
  defaultFolder("design", "Design", [
    defaultShortcut("Unsplash", "https://unsplash.com"),
    defaultShortcut("Pexels", "https://www.pexels.com"),
    defaultShortcut("Pixabay", "https://pixabay.com"),
    defaultShortcut("Framer", "https://www.framer.com"),
    defaultShortcut("Miro", "https://miro.com"),
    defaultShortcut("Coolors", "https://coolors.co"),
  ]),
  defaultShortcut("Cloudflare", "https://www.cloudflare.com"),
  defaultShortcut("DigitalOcean", "https://www.digitalocean.com"),
  defaultFolder("cloud", "Cloud & Tools", [
    defaultShortcut("Google Cloud", "https://cloud.google.com"),
    defaultShortcut("AWS", "https://aws.amazon.com"),
    defaultShortcut("Microsoft Azure", "https://azure.microsoft.com"),
    defaultShortcut("GitLab", "https://gitlab.com"),
    defaultShortcut("Docker Hub", "https://hub.docker.com"),
    defaultShortcut("Postman", "https://www.postman.com"),
  ]),
  defaultShortcut("ESPN", "https://www.espn.com"),
  defaultShortcut("FIFA", "https://www.fifa.com"),
  defaultFolder("sports", "Sports", [
    defaultShortcut("NBA", "https://www.nba.com"),
    defaultShortcut("Formula 1", "https://www.formula1.com"),
    defaultShortcut("UEFA", "https://www.uefa.com"),
    defaultShortcut("Olympics", "https://www.olympics.com"),
    defaultShortcut("Strava", "https://www.strava.com"),
    defaultShortcut("The Athletic", "https://www.nytimes.com/athletic"),
  ]),
];

function readJsonStorageValue(key: string) {
  const saved = window.localStorage.getItem(key);
  if (!saved) {
    return undefined;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return saved;
  }
}

function readStoredSearchEngineSettings(): StoredSearchEngineSettings {
  const storedValue = readJsonStorageValue(SEARCH_ENGINE_SETTINGS_KEY);
  if (!storedValue || typeof storedValue !== "object") {
    return {};
  }

  return storedValue as StoredSearchEngineSettings;
}

function saveStoredSearchEngineSettings(settings: StoredSearchEngineSettings) {
  window.localStorage.setItem(
    SEARCH_ENGINE_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function readStoredShortcuts() {
  const storedValue = readJsonStorageValue(SHORTCUTS_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return DEFAULT_SHORTCUTS;
  }

  return normalizeShortcuts(storedValue);
}

function saveStoredShortcuts(shortcuts: ShortcutNode[]) {
  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
}

function readStoredWallpaperUrl() {
  return normalizeStoredWallpaperUrl(
    readJsonStorageValue(WALLPAPER_STORAGE_KEY),
  );
}

function saveStoredWallpaperUrl(wallpaperUrl: string | null) {
  if (wallpaperUrl) {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaperUrl);
    return;
  }

  window.localStorage.removeItem(WALLPAPER_STORAGE_KEY);
}

function readStoredLauncherSettings() {
  return normalizeLauncherSettings(
    readJsonStorageValue(LAUNCHER_SETTINGS_STORAGE_KEY),
  );
}

function saveStoredLauncherSettings(settings: LauncherSettings) {
  window.localStorage.setItem(
    LAUNCHER_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
}

export const platform: Platform = {
  shortcuts: {
    read: async () => readStoredShortcuts(),
    save: async (shortcuts) => saveStoredShortcuts(shortcuts),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== SHORTCUTS_STORAGE_KEY) {
          return;
        }

        onChange(readStoredShortcuts());
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  wallpaper: {
    read: async () => readStoredWallpaperUrl(),
    save: async (wallpaperUrl) => saveStoredWallpaperUrl(wallpaperUrl),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== WALLPAPER_STORAGE_KEY) {
          return;
        }

        onChange(readStoredWallpaperUrl());
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  launcherSettings: {
    read: async () => readStoredLauncherSettings(),
    save: async (settings) => saveStoredLauncherSettings(settings),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === LAUNCHER_SETTINGS_STORAGE_KEY) {
          onChange(readStoredLauncherSettings());
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  searchEngineSettings: {
    read: async () => readStoredSearchEngineSettings(),
    save: async (settings) => saveStoredSearchEngineSettings(settings),
  },
  browserBookmarks: {
    import: async () => {
      return {
        importedCount: 0,
        skippedDuplicateCount: 0,
        folderCount: 0,
        unsupported: true,
      };
    },
  },
};
