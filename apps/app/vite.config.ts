import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
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
    plugins: [react()],
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
