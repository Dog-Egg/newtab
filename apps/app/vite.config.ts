import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";
import { manifest } from "./manifest.ts";
import { appVersion } from "./build/version.ts";

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
    input.background = "src/background/index.ts";
  }

  return {
    base: "./",
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    publicDir: isExtension ? "public" : false,
    plugins: [
      react(),
      ...(mode === "analyze"
        ? [
            visualizer({
              open: true,
            }),
          ]
        : []),
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
      // Chrome extension pages can reject Vite's modulepreload resource
      // reuse across extension worlds and report it as an unused preload.
      ...(isExtension ? { modulePreload: false } : {}),
      chunkSizeWarningLimit: 600,
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
