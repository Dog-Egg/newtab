# Browser Tab

Monorepo for the Browser Tab extension and its official website.

## Apps

- `apps/extension`: Vite + React + TypeScript browser extension that replaces the browser new tab page.
- `apps/web`: Astro + TypeScript + Tailwind CSS static website.

## Scripts

```sh
pnpm install
pnpm dev:extension
pnpm dev:web
pnpm build
```

Load `apps/extension/dist` as an unpacked extension in Chrome or another Chromium-based browser after building the extension.
