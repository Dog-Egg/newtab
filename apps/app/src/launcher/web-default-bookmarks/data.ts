import type { en } from "./en";

export type DefaultBookmarkTitleKey = keyof typeof en;

export type DefaultBookmarkNode =
  | { type: "item"; id: string; title: string; url: string }
  | {
      type: "folder";
      id: string;
      titleKey: DefaultBookmarkTitleKey;
      children: DefaultBookmarkNode[];
    };

export type DefaultBookmarkRoot = {
  id: string;
  titleKey: DefaultBookmarkTitleKey;
  children: DefaultBookmarkNode[];
};

const item = (url: string, title: string): DefaultBookmarkNode => ({
  type: "item",
  id: url,
  title,
  url,
});

const folder = (
  id: string,
  titleKey: DefaultBookmarkTitleKey,
  children: DefaultBookmarkNode[],
): DefaultBookmarkNode => ({ type: "folder", id, titleKey, children });

export const defaultBookmarks: DefaultBookmarkRoot[] = [
  {
    id: "default",
    titleKey: "home",
    children: [
      folder("folder-daily", "daily", [
        item("https://mail.google.com", "Gmail"),
        item("https://calendar.google.com", "Google Calendar"),
      ]),
      item("https://www.youtube.com", "YouTube"),
      item("https://x.com", "X"),
      item("https://www.reddit.com", "Reddit"),
      item("https://discord.com", "Discord"),
      item("https://open.spotify.com", "Spotify"),
      folder("folder-social", "social", [
        item("https://www.instagram.com", "Instagram"),
        item("https://www.whatsapp.com", "WhatsApp"),
        item("https://telegram.org", "Telegram"),
      ]),
      item("https://www.facebook.com", "Facebook"),
      item("https://www.wikipedia.org", "Wikipedia"),
      item("https://www.linkedin.com", "LinkedIn"),
      item("https://www.paypal.com", "PayPal"),
      folder("folder-shopping", "shopping", [
        item("https://www.amazon.com", "Amazon"),
        item("https://www.etsy.com", "Etsy"),
      ]),
      item("https://www.ebay.com", "eBay"),
      item("https://www.disneyplus.com", "Disney+"),
      item("https://www.netflix.com", "Netflix"),
      item("https://www.twitch.tv", "Twitch"),
      item("https://www.booking.com", "Booking.com"),
      item("https://www.primevideo.com", "Prime Video"),
      folder("folder-tools", "tools", [
        item("https://translate.google.com", "Google Translate"),
        item("https://www.speedtest.net", "Speedtest"),
        item("https://archive.org", "Internet Archive"),
      ]),
      item("https://www.apple.com", "Apple"),
      item("https://www.ikea.com", "IKEA"),
      item("https://soundcloud.com", "SoundCloud"),
      item("https://www.imdb.com", "IMDb"),
      folder("folder-news", "news", [
        item("https://www.bbc.com", "BBC"),
        item("https://www.reuters.com", "Reuters"),
      ]),
      item("https://www.nytimes.com", "The New York Times"),
      item("https://apnews.com", "AP News"),
      folder("folder-travel", "travel", [
        item("https://www.tripadvisor.com", "Tripadvisor"),
        item("https://www.skyscanner.com", "Skyscanner"),
        item("https://www.uber.com", "Uber"),
      ]),
      item("https://mail.proton.me", "Proton Mail"),
    ],
  },
  {
    id: "category-work",
    titleKey: "work",
    children: [
      item("https://www.notion.so", "Notion"),
      folder("folder-development", "development", [
        item("https://github.com", "GitHub"),
        item("https://stackoverflow.com", "Stack Overflow"),
        item("https://developer.mozilla.org", "MDN"),
      ]),
      item("https://www.figma.com", "Figma"),
      item("https://slack.com", "Slack"),
      folder("folder-google-workspace", "google", [
        item("https://drive.google.com", "Google Drive"),
        item("https://docs.google.com", "Google Docs"),
      ]),
      item("https://chatgpt.com", "ChatGPT"),
      item("https://zoom.us", "Zoom"),
      item("https://trello.com", "Trello"),
      item("https://vercel.com", "Vercel"),
    ],
  },
  {
    id: "category-inspiration",
    titleKey: "inspiration",
    children: [
      item("https://www.pinterest.com", "Pinterest"),
      folder("folder-reading", "reading", [
        item("https://medium.com", "Medium"),
        item("https://www.coursera.org", "Coursera"),
      ]),
      item("https://unsplash.com", "Unsplash"),
      item("https://dribbble.com", "Dribbble"),
      folder("folder-somewhere", "somewhere", [
        item("https://www.google.com/maps", "Google Maps"),
        item("https://www.airbnb.com", "Airbnb"),
      ]),
      item("https://www.behance.net", "Behance"),
      folder("folder-resources", "resources", [
        item("https://www.pexels.com", "Pexels"),
        item("https://www.framer.com", "Framer"),
        item("https://coolors.co", "Coolors"),
      ]),
      item("https://www.duolingo.com", "Duolingo"),
      item("https://www.are.na", "Are.na"),
    ],
  },
];
