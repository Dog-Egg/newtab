import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(siteRoot, "../..");
const appDist = resolve(workspaceRoot, "apps/app/dist/web");
const siteAppPublicDir = resolve(siteRoot, "public/app");

await rm(siteAppPublicDir, { recursive: true, force: true });
await mkdir(siteAppPublicDir, { recursive: true });
await cp(appDist, siteAppPublicDir, { recursive: true });

console.log(`Synced app build to ${siteAppPublicDir}`);
