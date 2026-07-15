import {
  ACTIVE_CATEGORY_ID_STORAGE_KEY,
  LAUNCHER_STORAGE_KEY,
  DEFAULT_CATEGORY,
  normalizeLauncher,
  type ShortcutCategory,
} from "../Launcher/launcher";
import {
  SEARCH_ENGINE_SETTINGS_KEY,
  type Platform,
  type StoredSearchEngineSettings,
} from "./types";
import {
  normalizeSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from "../Settings/settings";

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

const DEFAULT_LAUNCHER: ShortcutCategory[] = [
  {
    ...DEFAULT_CATEGORY,
    shortcuts: [
      defaultShortcut("YouTube", "https://www.youtube.com"),
      defaultShortcut("Wikipedia", "https://www.wikipedia.org"),
      defaultShortcut("Reddit", "https://www.reddit.com"),
      defaultShortcut("ChatGPT", "https://chatgpt.com"),
      defaultShortcut("GitHub", "https://github.com"),
      defaultShortcut("WhatsApp", "https://www.whatsapp.com"),
      defaultFolder("social", "Social", [
        defaultShortcut("Facebook", "https://www.facebook.com"),
        defaultShortcut("Instagram", "https://www.instagram.com"),
        defaultShortcut("X", "https://x.com"),
        defaultShortcut("LinkedIn", "https://www.linkedin.com"),
      ]),
      defaultFolder("entertainment", "Entertainment", [
        defaultShortcut("Netflix", "https://www.netflix.com"),
        defaultShortcut("Spotify", "https://open.spotify.com"),
        defaultShortcut("Twitch", "https://www.twitch.tv"),
        defaultShortcut("Disney+", "https://www.disneyplus.com"),
      ]),
    ],
  },
  {
    id: "category-work",
    name: "Work",
    shortcuts: [
      defaultShortcut("Notion", "https://www.notion.so"),
      defaultShortcut("Figma", "https://www.figma.com"),
      defaultShortcut("Zoom", "https://zoom.us"),
      defaultShortcut("Slack", "https://slack.com"),
      defaultShortcut("Trello", "https://trello.com"),
      defaultFolder("google-workspace", "Google Workspace", [
        defaultShortcut("Gmail", "https://mail.google.com"),
        defaultShortcut("Google Drive", "https://drive.google.com"),
        defaultShortcut("Google Calendar", "https://calendar.google.com"),
        defaultShortcut("Google Docs", "https://docs.google.com"),
      ]),
      defaultFolder("development", "Development", [
        defaultShortcut("Stack Overflow", "https://stackoverflow.com"),
        defaultShortcut("MDN", "https://developer.mozilla.org"),
        defaultShortcut("Vercel", "https://vercel.com"),
        defaultShortcut("npm", "https://www.npmjs.com"),
      ]),
    ],
  },
  {
    id: "category-inspiration",
    name: "Inspiration",
    shortcuts: [
      defaultShortcut("Behance", "https://www.behance.net"),
      defaultShortcut("Dribbble", "https://dribbble.com"),
      defaultShortcut("Pinterest", "https://www.pinterest.com"),
      defaultShortcut("Medium", "https://medium.com"),
      defaultShortcut("Adobe", "https://www.adobe.com"),
      defaultFolder("design-resources", "Design Resources", [
        defaultShortcut("Unsplash", "https://unsplash.com"),
        defaultShortcut("Pexels", "https://www.pexels.com"),
        defaultShortcut("Framer", "https://www.framer.com"),
        defaultShortcut("Coolors", "https://coolors.co"),
      ]),
      defaultFolder("learning", "Learning", [
        defaultShortcut("Coursera", "https://www.coursera.org"),
        defaultShortcut("Khan Academy", "https://www.khanacademy.org"),
        defaultShortcut("Udemy", "https://www.udemy.com"),
        defaultShortcut("Duolingo", "https://www.duolingo.com"),
      ]),
    ],
  },
  {
    id: "category-life",
    name: "Life",
    shortcuts: [
      defaultShortcut("Telegram", "https://telegram.org"),
      defaultShortcut("Proton", "https://proton.me"),
      defaultShortcut("Apple", "https://www.apple.com"),
      defaultShortcut("PayPal", "https://www.paypal.com"),
      defaultFolder("shopping", "Shopping", [
        defaultShortcut("Amazon", "https://www.amazon.com"),
        defaultShortcut("eBay", "https://www.ebay.com"),
        defaultShortcut("Etsy", "https://www.etsy.com"),
        defaultShortcut("IKEA", "https://www.ikea.com"),
      ]),
      defaultFolder("travel", "Travel", [
        defaultShortcut("Booking.com", "https://www.booking.com"),
        defaultShortcut("Airbnb", "https://www.airbnb.com"),
        defaultShortcut("Tripadvisor", "https://www.tripadvisor.com"),
        defaultShortcut("Google Maps", "https://www.google.com/maps"),
      ]),
      defaultFolder("news", "News", [
        defaultShortcut("BBC", "https://www.bbc.com"),
        defaultShortcut("CNN", "https://www.cnn.com"),
        defaultShortcut("Reuters", "https://www.reuters.com"),
        defaultShortcut("AP News", "https://apnews.com"),
      ]),
    ],
  },
];

function readJsonStorageValue(key: string) {
  const saved = window.sessionStorage.getItem(key);
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
  window.sessionStorage.setItem(
    SEARCH_ENGINE_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}

function readStoredLauncher() {
  const storedValue = readJsonStorageValue(LAUNCHER_STORAGE_KEY);
  if (typeof storedValue === "undefined") {
    return DEFAULT_LAUNCHER;
  }

  return normalizeLauncher(storedValue);
}

function saveStoredLauncher(categories: ReturnType<typeof normalizeLauncher>) {
  window.sessionStorage.setItem(
    LAUNCHER_STORAGE_KEY,
    JSON.stringify(categories),
  );
}

function readStoredActiveCategoryId() {
  const value = readJsonStorageValue(ACTIVE_CATEGORY_ID_STORAGE_KEY);
  return typeof value === "string" ? value : DEFAULT_CATEGORY.id;
}

function readStoredSettings() {
  return normalizeSettings(readJsonStorageValue(SETTINGS_STORAGE_KEY));
}

function saveStoredSettings(settings: Settings) {
  window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export const platform: Platform = {
  defaultLocale: "en",
  launcher: {
    read: async () => readStoredLauncher(),
    save: async (categories) => saveStoredLauncher(categories),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key !== LAUNCHER_STORAGE_KEY) {
          return;
        }

        onChange(readStoredLauncher());
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  activeCategoryId: {
    read: async () => readStoredActiveCategoryId(),
    save: async (categoryId) =>
      window.sessionStorage.setItem(
        ACTIVE_CATEGORY_ID_STORAGE_KEY,
        JSON.stringify(categoryId),
      ),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === ACTIVE_CATEGORY_ID_STORAGE_KEY) {
          onChange(readStoredActiveCategoryId());
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  },
  settings: {
    read: async () => readStoredSettings(),
    save: async (settings) => saveStoredSettings(settings),
    subscribe: (onChange) => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === SETTINGS_STORAGE_KEY) {
          onChange(readStoredSettings());
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
