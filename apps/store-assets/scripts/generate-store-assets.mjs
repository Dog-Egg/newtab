import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const storeAssetsDirectory = resolve(scriptDirectory, "..");
const workspaceDirectory = resolve(storeAssetsDirectory, "../..");
const outputDirectory = resolve(storeAssetsDirectory, "output");

const SCREENSHOT_VIEWPORT = { width: 1280, height: 800 };
const SMALL_PROMO_VIEWPORT = { width: 440, height: 280 };
const MARQUEE_PROMO_VIEWPORT = { width: 1400, height: 560 };
const STORE_ASSETS = [
  {
    name: "screenshot-1",
    locale: "zh-CN",
    route: "/__store-assets/screenshot/zh-CN?scene=quick-access",
    viewport: SCREENSHOT_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "screenshot-1-zh-CN.png"),
  },
  {
    name: "screenshot-1",
    locale: "en",
    route: "/__store-assets/screenshot/en?scene=quick-access",
    viewport: SCREENSHOT_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "screenshot-1-en.png"),
  },
  {
    name: "screenshot-2",
    locale: "zh-CN",
    route: "/__store-assets/screenshot/zh-CN?scene=search-suggestions",
    searchQuery: "b",
    viewport: SCREENSHOT_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "screenshot-2-zh-CN.png"),
  },
  {
    name: "screenshot-2",
    locale: "en",
    route: "/__store-assets/screenshot/en?scene=search-suggestions",
    searchQuery: "b",
    viewport: SCREENSHOT_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "screenshot-2-en.png"),
  },
  {
    name: "promo-small",
    locale: "zh-CN",
    route: "/__store-assets/promo-small?lang=zh-CN",
    viewport: SMALL_PROMO_VIEWPORT,
    waitForApp: false,
    outputPath: resolve(outputDirectory, "promo-small-zh-CN.png"),
  },
  {
    name: "promo-small",
    locale: "en",
    route: "/__store-assets/promo-small?lang=en",
    viewport: SMALL_PROMO_VIEWPORT,
    waitForApp: false,
    outputPath: resolve(outputDirectory, "promo-small-en.png"),
  },
  {
    name: "promo-marquee",
    locale: "zh-CN",
    route: "/__store-assets/promo-marquee?lang=zh-CN",
    viewport: MARQUEE_PROMO_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "promo-marquee-zh-CN.png"),
  },
  {
    name: "promo-marquee",
    locale: "en",
    route: "/__store-assets/promo-marquee?lang=en",
    viewport: MARQUEE_PROMO_VIEWPORT,
    waitForApp: true,
    outputPath: resolve(outputDirectory, "promo-marquee-en.png"),
  },
];
const SERVER_TIMEOUT_MS = 30_000;

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const previewProcesses = new Set();

function log(message) {
  console.log(`[store-assets] ${message}`);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: workspaceDirectory,
      stdio: "inherit",
      ...options,
    });

    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`})`,
        ),
      );
    });
  });
}

function startSitePreview(port) {
  const child = spawn(
    packageManager,
    [
      "--filter",
      "@project/site",
      "exec",
      "astro",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: workspaceDirectory,
      detached: process.platform !== "win32",
      env: { ...process.env, STORE_ASSETS_BUILD: "true" },
      stdio: "inherit",
    },
  );

  previewProcesses.add(child);
  child.once("exit", () => previewProcesses.delete(child));
  return child;
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null) return;

  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    child.kill("SIGTERM");
  }

  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000)),
  ]);

  if (child.exitCode === null) {
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function stopAllPreviews() {
  await Promise.all([...previewProcesses].map(stopPreview));
}

function findAvailablePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) rejectPromise(error);
        else if (port) resolvePromise(port);
        else rejectPromise(new Error("Could not allocate a preview port"));
      });
    });
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited before ${url} became available`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDocumentAssets(target, label) {
  await target.evaluate(() => document.fonts.ready);
  await target
    .waitForFunction(() =>
      [...document.images].every((image) => image.complete),
    )
    .catch(() => log(`${label}仍有图片未完成，继续截取已加载内容`));
  await target.evaluate(async () => {
    await Promise.all(
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => image.decode().catch(() => undefined)),
    );
  });
  await target.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
    `,
  });
  await target.evaluate(
    () =>
      new Promise((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(resolvePromise)),
      ),
  );
}

async function captureScreenshot(
  browser,
  { locale, url, viewport, waitForApp, searchQuery, outputPath },
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => log("物料页仍有长连接，继续等待可见资源"));
    await waitForDocumentAssets(page, "物料页");

    if (waitForApp) {
      const iframe = page.locator("[data-store-asset-canvas] iframe");
      await iframe.waitFor({ state: "visible" });
      const iframeHandle = await iframe.elementHandle();
      const appFrame = await iframeHandle?.contentFrame();
      if (!appFrame)
        throw new Error("Could not access the store asset app frame");

      await appFrame.waitForLoadState("domcontentloaded");
      await appFrame
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => log("应用预览仍有长连接，继续等待可见资源"));
      await appFrame.waitForFunction(
        () => (document.querySelector("#root")?.childElementCount ?? 0) > 0,
      );
      await waitForDocumentAssets(appFrame, "应用预览");

      if (searchQuery) {
        const searchInput = appFrame.getByRole("combobox");
        await searchInput.fill(searchQuery);

        const suggestions = appFrame.locator("#search-suggestions");
        await suggestions.waitFor({ state: "visible" });
        await suggestions.locator('[role="option"]').first().waitFor({
          state: "visible",
        });
        await waitForDocumentAssets(appFrame, "搜索建议");
      }
    }

    const canvas = page.locator("[data-store-asset-canvas]");
    await canvas.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: false,
    });
  } finally {
    await context.close();
  }
}

async function assertOpaque24BitPng(filePath, expectedViewport) {
  const png = await readFile(filePath);
  const signature = png.subarray(0, 8).toString("hex");
  const chunkType = png.subarray(12, 16).toString("ascii");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];

  if (signature !== "89504e470d0a1a0a" || chunkType !== "IHDR") {
    throw new Error(`${filePath} 不是有效的 PNG 文件`);
  }
  if (width !== expectedViewport.width || height !== expectedViewport.height) {
    throw new Error(
      `${filePath} 尺寸为 ${width}x${height}，预期为 ${expectedViewport.width}x${expectedViewport.height}`,
    );
  }
  if (bitDepth !== 8 || colorType !== 2) {
    throw new Error(
      `${filePath} 不是无 alpha 的 24 位 RGB PNG（bitDepth=${bitDepth}, colorType=${colorType}）`,
    );
  }
}

async function main() {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  log("已清空 output 目录");

  let browser;
  try {
    log("构建官网与应用预览");
    await run(packageManager, [
      "--filter",
      "@project/site",
      "build:store-assets",
    ]);

    const sitePort = await findAvailablePort();
    const siteUrl = `http://127.0.0.1:${sitePort}`;
    const sitePreview = startSitePreview(sitePort);
    await waitForServer(`${siteUrl}${STORE_ASSETS[0].route}`, sitePreview);

    browser = await chromium.launch({ headless: true });
    for (const asset of STORE_ASSETS) {
      const { width, height } = asset.viewport;
      log(`生成 ${asset.name} ${asset.locale} ${width}x${height}`);
      await captureScreenshot(browser, {
        ...asset,
        url: `${siteUrl}${asset.route}`,
      });
      await assertOpaque24BitPng(asset.outputPath, asset.viewport);
    }
    await stopPreview(sitePreview);
  } finally {
    await browser?.close();
    await stopAllPreviews();
  }

  log(`完成：${STORE_ASSETS.map(({ outputPath }) => outputPath).join(", ")}`);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void stopAllPreviews().finally(() => process.exit(1));
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[store-assets] 生成失败：${message}`);
  if (message.includes("Executable doesn't exist")) {
    console.error("[store-assets] 请先运行：pnpm setup:store-assets-browser");
  }
  process.exitCode = 1;
});
