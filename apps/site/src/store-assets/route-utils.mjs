import { globSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

const routeDirectory = new URL("./routes/", import.meta.url);

export const STORE_ASSET_ROUTE_PREFIX = "/__store-assets";

function normalizePath(path) {
  return path.split(sep).join("/");
}

function getRoutePattern(file) {
  const route = normalizePath(file)
    .replace(/\.astro$/, "")
    .replace(/(?:^|\/)index$/, "");

  return route
    ? `${STORE_ASSET_ROUTE_PREFIX}/${route}`
    : STORE_ASSET_ROUTE_PREFIX;
}

export function getStoreAssetRoutes() {
  return globSync("**/*.astro", {
    cwd: fileURLToPath(routeDirectory),
  })
    .sort()
    .map((file) => {
      const normalizedFile = normalizePath(file);

      return {
        pattern: getRoutePattern(file),
        entrypoint: new URL(normalizedFile, routeDirectory),
      };
    });
}
