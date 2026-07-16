import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const logoPath = resolve(appRoot, "../../assets/logo.svg");
const outputDir = resolve(appRoot, "public/icons");
const sizes = [16, 32, 48, 128];

const logo = await readFile(logoPath);
await mkdir(outputDir, { recursive: true });

await Promise.all(
  sizes.map((size) =>
    sharp(logo)
      .resize(size, size)
      .png()
      .toFile(resolve(outputDir, `logo-${size}.png`)),
  ),
);

console.log(`Generated extension icons from ${logoPath}`);
