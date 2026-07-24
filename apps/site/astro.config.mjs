import { defineConfig } from "astro/config";
import projectConfig from "../../project.config.json" with { type: "json" };

const isStoreAssetsBuild = process.env.STORE_ASSETS_BUILD === "true";

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
  integrations: [storeAssetsRoutes()],
});
