import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { productName } from "../../package.json";
import { manifest } from "./manifest";

function productNamePlugin(): Plugin {
  return {
    name: "product-name",
    transformIndexHtml(html) {
      return html.replace("%PRODUCT_NAME%", productName);
    },
  };
}

function extensionManifestPlugin(): Plugin {
  return {
    name: "extension-manifest",
    apply: "build",
    buildStart() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const isExtension = mode === "extension";
  const input: Record<string, string> = {
    index: "index.html",
  };

  if (isExtension) {
    input.background = "src/background.ts";
  }

  return {
    base: "./",
    publicDir: isExtension ? "public" : false,
    plugins: [
      react(),
      productNamePlugin(),
      ...(isExtension && command === "build"
        ? [extensionManifestPlugin()]
        : []),
    ],
    resolve: {
      alias: {
        "@platform": fileURLToPath(
          new URL(
            isExtension
              ? "./src/platform/extension.ts"
              : "./src/platform/web.ts",
            import.meta.url,
          ),
        ),
      },
    },
    build: {
      outDir: isExtension ? "dist/extension" : "dist/web",
      rollupOptions: {
        input,
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === "background"
              ? "background.js"
              : "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
