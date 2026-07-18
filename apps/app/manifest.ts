import { productName } from "../../package.json";

export const manifest = {
  manifest_version: 3,
  name: productName,
  version: "0.1.0",
  description: "A simple new tab replacement.",
  icons: {
    "16": "icons/logo-16.png",
    "32": "icons/logo-32.png",
    "48": "icons/logo-48.png",
    "128": "icons/logo-128.png",
  },
  permissions: ["bookmarks", "contextMenus", "storage"],
  background: {
    service_worker: "background.js",
    type: "module",
  },
  chrome_url_overrides: {
    newtab: "index.html",
  },
} as const;
