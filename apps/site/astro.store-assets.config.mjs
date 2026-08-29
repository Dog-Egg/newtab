import { defineConfig } from "astro/config";
import siteConfig from "./astro.config.mjs";
import { getStoreAssetRoutes } from "./src/store-assets/route-utils.mjs";

const storeAssetsRoutes = {
  name: "store-assets-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      for (const route of getStoreAssetRoutes()) {
        injectRoute({
          ...route,
          prerender: true,
        });
      }
    },
  },
};

export default defineConfig({
  ...siteConfig,
  outDir: "./.store-assets-dist",
  integrations: [storeAssetsRoutes],
});
