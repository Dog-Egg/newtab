# NewTab

Monorepo for the NewTab app and its official site.

## Apps

- `apps/app`: Vite + React + TypeScript app that can be built for the browser new tab experience.
- `apps/site`: Astro + TypeScript + Tailwind CSS official site.

## Scripts

```sh
pnpm install
pnpm dev:app
pnpm dev:site
pnpm build:app
pnpm build:site
```

Load `apps/app/dist` as an unpacked extension in Chrome or another Chromium-based browser after building the app.
