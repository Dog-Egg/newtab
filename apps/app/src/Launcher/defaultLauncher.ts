import {
  normalizeLegacyLauncher,
  type LegacyLauncherCategory,
} from "./legacyLauncher";
import {
  DEFAULT_CATEGORY_ID,
  type LauncherBookmarkCategory,
} from "./bookmarkLayout";
import type { AppLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { zhCN } from "../i18n/locales/zh-CN";

function createDefaultBookmarkFactory(locale: AppLocale) {
  const localize = (original: string, zhCN?: string) =>
    locale === "zh-CN" && zhCN ? zhCN : original;
  const bookmark = (original: string, url: string, zhCN?: string) => ({
    type: "item" as const,
    id: url,
    title: localize(original, zhCN),
    url,
  });
  const folder = (
    id: string,
    original: string,
    children: ReturnType<typeof bookmark>[],
    zhCN?: string,
  ) => ({
    type: "folder" as const,
    id: `folder-${id}`,
    title: localize(original, zhCN),
    children,
  });

  return {
    bookmark,
    folder,
  };
}

export function createWebDefaultBookmarks(
  locale: AppLocale,
): LauncherBookmarkCategory[] {
  const names = getDefaultCategoryNames(locale);
  const { bookmark, folder } = createDefaultBookmarkFactory(locale);

  return [
    {
      id: DEFAULT_CATEGORY_ID,
      name: names.home,
      bookmarks: [
        bookmark("YouTube", "https://www.youtube.com"),
        folder(
          "daily",
          "Daily",
          [
            bookmark("Gmail", "https://mail.google.com"),
            bookmark(
              "Google Calendar",
              "https://calendar.google.com",
              "谷歌日历",
            ),
          ],
          "日常",
        ),
        bookmark("X", "https://x.com"),
        bookmark("Reddit", "https://www.reddit.com"),
        bookmark("Discord", "https://discord.com"),
        bookmark("Spotify", "https://open.spotify.com"),
        folder(
          "social",
          "Social",
          [
            bookmark("Instagram", "https://www.instagram.com"),
            bookmark("WhatsApp", "https://www.whatsapp.com"),
            bookmark("Telegram", "https://telegram.org"),
          ],
          "社交",
        ),
        bookmark("Facebook", "https://www.facebook.com"),
        bookmark("Wikipedia", "https://www.wikipedia.org", "维基百科"),
        bookmark("LinkedIn", "https://www.linkedin.com", "领英"),
        bookmark("PayPal", "https://www.paypal.com"),
        folder(
          "shopping",
          "Shopping",
          [
            bookmark("Amazon", "https://www.amazon.com", "亚马逊"),
            bookmark("Etsy", "https://www.etsy.com"),
          ],
          "购物",
        ),
        bookmark("eBay", "https://www.ebay.com"),
        bookmark("Netflix", "https://www.netflix.com"),
        bookmark("Disney+", "https://www.disneyplus.com"),
        bookmark("Twitch", "https://www.twitch.tv"),
        bookmark("Prime Video", "https://www.primevideo.com"),
        folder(
          "tools",
          "Tools",
          [
            bookmark(
              "Google Translate",
              "https://translate.google.com",
              "谷歌翻译",
            ),
            bookmark("Speedtest", "https://www.speedtest.net"),
            bookmark("Internet Archive", "https://archive.org", "互联网档案馆"),
          ],
          "工具",
        ),
        bookmark("Apple", "https://www.apple.com", "苹果"),
        bookmark("IKEA", "https://www.ikea.com", "宜家"),
        bookmark("SoundCloud", "https://soundcloud.com"),
        bookmark("IMDb", "https://www.imdb.com"),
        folder(
          "news",
          "News",
          [
            bookmark("BBC", "https://www.bbc.com"),
            bookmark("Reuters", "https://www.reuters.com", "路透社"),
          ],
          "新闻",
        ),
        bookmark("The New York Times", "https://www.nytimes.com", "纽约时报"),
        bookmark("AP News", "https://apnews.com", "美联社"),
        folder(
          "travel",
          "Travel",
          [
            bookmark("Tripadvisor", "https://www.tripadvisor.com", "猫途鹰"),
            bookmark("Skyscanner", "https://www.skyscanner.com", "天巡"),
            bookmark("Uber", "https://www.uber.com"),
          ],
          "旅行",
        ),
        bookmark("Booking.com", "https://www.booking.com"),
        bookmark("Proton Mail", "https://mail.proton.me"),
      ],
    },
    {
      id: "category-work",
      name: names.work,
      bookmarks: [
        bookmark("Notion", "https://www.notion.so"),
        folder(
          "development",
          "Development",
          [
            bookmark("GitHub", "https://github.com"),
            bookmark("Stack Overflow", "https://stackoverflow.com"),
            bookmark("MDN", "https://developer.mozilla.org"),
          ],
          "开发",
        ),
        bookmark("Figma", "https://www.figma.com"),
        bookmark("Slack", "https://slack.com"),
        folder(
          "google-workspace",
          "Google",
          [
            bookmark(
              "Google Drive",
              "https://drive.google.com",
              "谷歌云端硬盘",
            ),
            bookmark("Google Docs", "https://docs.google.com", "谷歌文档"),
          ],
          "谷歌",
        ),
        bookmark("ChatGPT", "https://chatgpt.com"),
        bookmark("Zoom", "https://zoom.us"),
        bookmark("Trello", "https://trello.com"),
        bookmark("Vercel", "https://vercel.com"),
      ],
    },
    {
      id: "category-inspiration",
      name: names.inspiration,
      bookmarks: [
        bookmark("Pinterest", "https://www.pinterest.com"),
        folder(
          "reading",
          "Reading",
          [
            bookmark("Medium", "https://medium.com"),
            bookmark("Coursera", "https://www.coursera.org"),
          ],
          "阅读",
        ),
        bookmark("Unsplash", "https://unsplash.com"),
        bookmark("Dribbble", "https://dribbble.com"),
        folder(
          "somewhere",
          "Somewhere",
          [
            bookmark("Google Maps", "https://www.google.com/maps", "谷歌地图"),
            bookmark("Airbnb", "https://www.airbnb.com"),
          ],
          "去处",
        ),
        bookmark("Behance", "https://www.behance.net"),
        folder(
          "resources",
          "Resources",
          [
            bookmark("Pexels", "https://www.pexels.com"),
            bookmark("Framer", "https://www.framer.com"),
            bookmark("Coolors", "https://coolors.co"),
          ],
          "资源",
        ),
        bookmark("Duolingo", "https://www.duolingo.com", "多邻国"),
        bookmark("Are.na", "https://www.are.na"),
      ],
    },
  ];
}

function createEmptyLegacyLauncherCategory(
  locale: AppLocale,
): LegacyLauncherCategory {
  return {
    id: DEFAULT_CATEGORY_ID,
    name: getDefaultCategoryNames(locale).home,
    shortcuts: [],
  };
}

export function normalizeStoredExtensionLauncher(
  value: unknown,
  locale: AppLocale,
) {
  // Extension 不注入演示书签；已保存的旧 launcher 数据仍按原结构读取。
  return normalizeLegacyLauncher(
    value,
    createEmptyLegacyLauncherCategory(locale),
  );
}

export function getDefaultCategoryNames(locale: AppLocale) {
  return (locale === "zh-CN" ? zhCN : en).launcher.defaultCategories;
}

export function getOtherBookmarksFolderTitle(locale: AppLocale) {
  return (locale === "zh-CN" ? zhCN : en).launcher.otherBookmarks;
}
