import { execFileSync } from "node:child_process";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import projectConfig from "../../project.config.json" with { type: "json" };

const isStoreAssetsBuild = process.env.STORE_ASSETS_BUILD === "true";
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

function storeAssetsRoutes() {
  return {
    name: "store-assets-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        if (!isStoreAssetsBuild) return;

        injectRoute({
          pattern: "/__store-assets/screenshot/zh-CN",
          entrypoint: new URL(
            "./src/store-assets/ScreenshotZhPage.astro",
            import.meta.url,
          ),
          prerender: true,
        });
        injectRoute({
          pattern: "/__store-assets/screenshot/en",
          entrypoint: new URL(
            "./src/store-assets/ScreenshotEnPage.astro",
            import.meta.url,
          ),
          prerender: true,
        });
        injectRoute({
          pattern: "/__store-assets/promo-small",
          entrypoint: new URL(
            "./src/store-assets/PromoSmall.astro",
            import.meta.url,
          ),
          prerender: true,
        });
        injectRoute({
          pattern: "/__store-assets/promo-marquee",
          entrypoint: new URL(
            "./src/store-assets/PromoMarquee.astro",
            import.meta.url,
          ),
          prerender: true,
        });
      },
    },
  };
}

export default defineConfig({
  site: projectConfig.site.url,
  outDir: isStoreAssetsBuild ? "./.store-assets-dist" : "./dist",
  integrations: [
    storeAssetsRoutes(),
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname;
        return (
          !pathname.startsWith("/__store-assets/") && !/\.[^/]+$/.test(pathname)
        );
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
