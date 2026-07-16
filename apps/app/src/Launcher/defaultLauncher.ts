import {
  DEFAULT_CATEGORY_ID,
  normalizeLauncher,
  type ShortcutCategory,
} from "./launcher";
import type { AppLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { zhCN } from "../i18n/locales/zh-CN";

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

function createDefaultLauncher(locale: AppLocale): ShortcutCategory[] {
  defaultShortcutOrder = 0;
  const names = getDefaultCategoryNames(locale);
  const title = (original: string, zhCN?: string) =>
    locale === "zh-CN" && zhCN ? zhCN : original;
  const shortcut = (original: string, url: string, zhCN?: string) =>
    defaultShortcut(title(original, zhCN), url);
  const folder = (
    id: string,
    original: string,
    children: ReturnType<typeof defaultShortcut>[],
    zhCN?: string,
  ) => defaultFolder(id, title(original, zhCN), children);

  return [
    {
      ...createEmptyDefaultCategory(locale),
      shortcuts: [
        shortcut("YouTube", "https://www.youtube.com"),
        folder(
          "daily",
          "Daily",
          [
            shortcut("Gmail", "https://mail.google.com"),
            shortcut(
              "Google Calendar",
              "https://calendar.google.com",
              "谷歌日历",
            ),
          ],
          "日常",
        ),
        shortcut("X", "https://x.com"),
        shortcut("Reddit", "https://www.reddit.com"),
        shortcut("Discord", "https://discord.com"),
        shortcut("Spotify", "https://open.spotify.com"),
        folder(
          "social",
          "Social",
          [
            shortcut("Instagram", "https://www.instagram.com"),
            shortcut("WhatsApp", "https://www.whatsapp.com"),
            shortcut("Telegram", "https://telegram.org"),
          ],
          "社交",
        ),
        shortcut("Facebook", "https://www.facebook.com"),
        shortcut("Wikipedia", "https://www.wikipedia.org", "维基百科"),
        shortcut("LinkedIn", "https://www.linkedin.com", "领英"),
        shortcut("PayPal", "https://www.paypal.com"),
        folder(
          "shopping",
          "Shopping",
          [
            shortcut("Amazon", "https://www.amazon.com", "亚马逊"),
            shortcut("Etsy", "https://www.etsy.com"),
          ],
          "购物",
        ),
        shortcut("eBay", "https://www.ebay.com"),
        shortcut("Netflix", "https://www.netflix.com"),
        shortcut("Disney+", "https://www.disneyplus.com"),
        shortcut("Twitch", "https://www.twitch.tv"),
        shortcut("Prime Video", "https://www.primevideo.com"),
        folder(
          "tools",
          "Tools",
          [
            shortcut(
              "Google Translate",
              "https://translate.google.com",
              "谷歌翻译",
            ),
            shortcut("Speedtest", "https://www.speedtest.net"),
            shortcut("Internet Archive", "https://archive.org", "互联网档案馆"),
          ],
          "工具",
        ),
        shortcut("Apple", "https://www.apple.com", "苹果"),
        shortcut("IKEA", "https://www.ikea.com", "宜家"),
        shortcut("SoundCloud", "https://soundcloud.com"),
        shortcut("IMDb", "https://www.imdb.com"),
        folder(
          "news",
          "News",
          [
            shortcut("BBC", "https://www.bbc.com"),
            shortcut("Reuters", "https://www.reuters.com", "路透社"),
          ],
          "新闻",
        ),
        shortcut("The New York Times", "https://www.nytimes.com", "纽约时报"),
        shortcut("AP News", "https://apnews.com", "美联社"),
        folder(
          "travel",
          "Travel",
          [
            shortcut("Tripadvisor", "https://www.tripadvisor.com", "猫途鹰"),
            shortcut("Skyscanner", "https://www.skyscanner.com", "天巡"),
            shortcut("Uber", "https://www.uber.com"),
          ],
          "旅行",
        ),
        shortcut("Booking.com", "https://www.booking.com"),
        shortcut("Proton Mail", "https://mail.proton.me"),
      ],
    },
    {
      id: "category-work",
      name: names.work,
      shortcuts: [
        shortcut("Notion", "https://www.notion.so"),
        folder(
          "development",
          "Development",
          [
            shortcut("GitHub", "https://github.com"),
            shortcut("Stack Overflow", "https://stackoverflow.com"),
            shortcut("MDN", "https://developer.mozilla.org"),
          ],
          "开发",
        ),
        shortcut("Figma", "https://www.figma.com"),
        shortcut("Slack", "https://slack.com"),
        folder(
          "google-workspace",
          "Google",
          [
            shortcut(
              "Google Drive",
              "https://drive.google.com",
              "谷歌云端硬盘",
            ),
            shortcut("Google Docs", "https://docs.google.com", "谷歌文档"),
          ],
          "谷歌",
        ),
        shortcut("ChatGPT", "https://chatgpt.com"),
        shortcut("Zoom", "https://zoom.us"),
        shortcut("Trello", "https://trello.com"),
        shortcut("Vercel", "https://vercel.com"),
      ],
    },
    {
      id: "category-inspiration",
      name: names.inspiration,
      shortcuts: [
        shortcut("Pinterest", "https://www.pinterest.com"),
        folder(
          "reading",
          "Reading",
          [
            shortcut("Medium", "https://medium.com"),
            shortcut("Coursera", "https://www.coursera.org"),
          ],
          "阅读",
        ),
        shortcut("Unsplash", "https://unsplash.com"),
        shortcut("Dribbble", "https://dribbble.com"),
        folder(
          "somewhere",
          "Somewhere",
          [
            shortcut("Google Maps", "https://www.google.com/maps", "谷歌地图"),
            shortcut("Airbnb", "https://www.airbnb.com"),
          ],
          "去处",
        ),
        shortcut("Behance", "https://www.behance.net"),
        folder(
          "resources",
          "Resources",
          [
            shortcut("Pexels", "https://www.pexels.com"),
            shortcut("Framer", "https://www.framer.com"),
            shortcut("Coolors", "https://coolors.co"),
          ],
          "资源",
        ),
        shortcut("Duolingo", "https://www.duolingo.com", "多邻国"),
        shortcut("Are.na", "https://www.are.na"),
      ],
    },
  ];
}

function createEmptyDefaultCategory(locale: AppLocale): ShortcutCategory {
  return {
    id: DEFAULT_CATEGORY_ID,
    name: getDefaultCategoryNames(locale).home,
    shortcuts: [],
  };
}

export function normalizeStoredLauncher(value: unknown, locale: AppLocale) {
  return typeof value === "undefined"
    ? createDefaultLauncher(locale)
    : normalizeLauncher(value, createEmptyDefaultCategory(locale));
}

function getDefaultCategoryNames(locale: AppLocale) {
  return (locale === "zh-CN" ? zhCN : en).launcher.defaultCategories;
}
