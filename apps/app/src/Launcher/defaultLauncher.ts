import { DEFAULT_CATEGORY_ID, type ShortcutCategory } from "./launcher";
import i18n, { type AppLocale } from "../i18n";

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

export function createDefaultLauncher(locale: AppLocale): ShortcutCategory[] {
  defaultShortcutOrder = 0;
  const t = i18n.getFixedT(locale);

  return [
    {
      ...createDefaultCategory(locale),
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
      name: t("launcher.defaultCategories.work"),
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
      name: t("launcher.defaultCategories.inspiration"),
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
      name: t("launcher.defaultCategories.life"),
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
}

export function createDefaultCategory(locale: AppLocale): ShortcutCategory {
  return {
    id: DEFAULT_CATEGORY_ID,
    name: i18n.getFixedT(locale)("launcher.defaultCategories.home"),
    shortcuts: [],
  };
}
