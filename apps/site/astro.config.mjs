import { execFileSync } from "node:child_process";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import projectConfig from "../../project.config.json" with { type: "json" };

const repositoryRoot = new URL("../../", import.meta.url);

function getSiteLastModified() {
  try {
    const value = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", "apps/site"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    return value || undefined;
  } catch {
    return undefined;
  }
}

const siteLastModified = getSiteLastModified();

export default defineConfig({
  site: projectConfig.site.url,
  integrations: [
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname;
        return !/\.[^/]+$/.test(pathname);
      },
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          zh: "zh-CN",
        },
      },
      serialize(item) {
        if (siteLastModified) item.lastmod = siteLastModified;

        const defaultLocaleUrl = item.links?.find(
          (link) => link.lang === "en",
        )?.url;
        if (defaultLocaleUrl) {
          item.links = [
            ...(item.links ?? []),
            { lang: "x-default", url: defaultLocaleUrl },
          ];
        }

        return item;
      },
    }),
  ],
});
