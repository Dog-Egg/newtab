/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_DEFAULT_WALLPAPER_URL?: string;
  readonly VITE_LOGO_DEV_API_TOKEN?: string;
}
