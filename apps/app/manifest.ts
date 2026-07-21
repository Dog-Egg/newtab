import projectConfig from "../../project.config.json";
import { appVersion } from "./build/version";

const productName = projectConfig.product.name;

export const manifest = {
  manifest_version: 3,
  default_locale: "en",
  name: "__MSG_extensionName__",
  short_name: productName,
  version: appVersion,
  description: "__MSG_extensionDescription__",
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
