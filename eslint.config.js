import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

const appFiles = ["apps/app/**/*.{js,mjs,cjs,ts,tsx}"];
const javascriptFiles = ["**/*.{js,mjs,cjs}"];
const typescriptFiles = ["**/*.{ts,tsx}"];

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.store-assets-dist/**",
      "**/node_modules/**",
      "**/.codegraph/**",
      "**/.pnpm-store/**",
      "**/*.astro",
      "apps/site/public/app/**",
    ],
  },
  {
    files: javascriptFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    files: typescriptFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: appFiles,
    plugins: reactHooks.configs.flat.recommended.plugins,
    rules: reactHooks.configs.flat.recommended.rules,
  },
];
