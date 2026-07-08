import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(webRoot, "../..");
const extensionDist = resolve(workspaceRoot, "apps/extension/dist");
const webExtensionPublicDir = resolve(webRoot, "public/extension");

await rm(webExtensionPublicDir, { recursive: true, force: true });
await mkdir(webExtensionPublicDir, { recursive: true });
await cp(extensionDist, webExtensionPublicDir, { recursive: true });

console.log(`Synced extension build to ${webExtensionPublicDir}`);
