import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  getStoreAssetRoutes,
  STORE_ASSET_ROUTE_PREFIX,
} from "../../site/src/store-assets/route-utils.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const storeAssetsDirectory = resolve(scriptDirectory, "..");
const workspaceDirectory = resolve(storeAssetsDirectory, "../..");
const outputDirectory = resolve(storeAssetsDirectory, "output");

const USAGE = `用法：
  pnpm run generate:store-assets
  pnpm run generate:store-assets -- --only <页面路径>

页面路径相对于 /__store-assets，例如 screenshot/en/1。`;

function getRelativeRoute(route) {
  const normalizedRoute = route
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  const prefix = STORE_ASSET_ROUTE_PREFIX.replace(/^\/+|\/+$/g, "");

  if (normalizedRoute === prefix) return "";
  if (normalizedRoute.startsWith(`${prefix}/`)) {
    return normalizedRoute.slice(prefix.length + 1);
  }

  return normalizedRoute;
}

function getOutputFile(route) {
  const relativeRoute = getRelativeRoute(route);

  return `${relativeRoute || "index"}.png`;
}

function parseArguments(args) {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  let values;

  try {
    ({ values } = parseArgs({
      args: normalizedArgs,
      options: {
        help: { type: "boolean", short: "h" },
        only: { type: "string", multiple: true },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\n\n${USAGE}`);
  }

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const onlyRoutes = values.only ?? [];
  if (onlyRoutes.length > 1) {
    throw new Error(`--only 只能指定一次\n\n${USAGE}`);
  }

  const onlyRoute = onlyRoutes[0];
  const normalizedRoute = onlyRoute ? getRelativeRoute(onlyRoute) : undefined;
  if (onlyRoute && !normalizedRoute) {
    throw new Error(`--only 需要一个页面路径\n\n${USAGE}`);
  }

  return normalizedRoute;
}

const allStoreAssets = getStoreAssetRoutes().map(({ pattern }) => {
  const outputFile = getOutputFile(pattern);

  return {
    route: pattern,
    outputFile,
    locale: pattern.includes("/zh-CN/") ? "zh-CN" : "en",
    outputPath: resolve(outputDirectory, outputFile),
  };
});

function selectStoreAssets(onlyRoute) {
  const storeAssets = onlyRoute
    ? allStoreAssets.filter(
        ({ route }) => getRelativeRoute(route) === onlyRoute,
      )
    : allStoreAssets;

  if (onlyRoute && storeAssets.length === 0) {
    const availableRoutes = allStoreAssets
      .map(({ route }) => getRelativeRoute(route))
      .join(", ");
    throw new Error(
      `未找到页面：${onlyRoute}\n可用页面：${availableRoutes}\n\n${USAGE}`,
    );
  }

  return storeAssets;
}

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
      "--config",
      "astro.store-assets.config.mjs",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: workspaceDirectory,
      detached: process.platform !== "win32",
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

async function readStoreAssetMetadata(page) {
  const metadata = await page.evaluate(() => {
    const getMeta = (name) =>
      document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ??
      "";
    const [width, height] = getMeta("store-asset-viewport")
      .split("x")
      .map(Number);

    return {
      viewport: { width, height },
      waitForApp: getMeta("store-asset-wait-for-app") === "true",
      searchQuery: getMeta("store-asset-search-query") || undefined,
    };
  });

  const { width, height } = metadata.viewport;
  if (![width, height].every(Number.isInteger) || width <= 0 || height <= 0) {
    throw new Error("物料页面缺少有效的 store-asset-viewport 元数据");
  }

  return metadata;
}

async function discoverStoreAssetMetadata(browser, { locale, url }) {
  const context = await browser.newContext({
    viewport: null,
    colorScheme: "light",
    locale,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return await readStoreAssetMetadata(page);
  } finally {
    await context.close();
  }
}

async function captureScreenshot(browser, { locale, url, outputPath }) {
  const metadata = await discoverStoreAssetMetadata(browser, { locale, url });
  const context = await browser.newContext({
    viewport: metadata.viewport,
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

    if (metadata.waitForApp) {
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

      if (metadata.searchQuery) {
        const searchInput = appFrame.getByRole("combobox");
        await searchInput.fill(metadata.searchQuery);

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

    return metadata;
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
  const onlyRoute = parseArguments(process.argv.slice(2));
  const storeAssets = selectStoreAssets(onlyRoute);

  if (!onlyRoute) {
    await rm(outputDirectory, { recursive: true, force: true });
    log("已清空 output 目录");
  } else {
    log(`仅生成 ${onlyRoute}，保留其他已有物料`);
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    storeAssets.map(({ outputPath }) =>
      mkdir(dirname(outputPath), { recursive: true }),
    ),
  );

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
    await waitForServer(`${siteUrl}${storeAssets[0].route}`, sitePreview);

    browser = await chromium.launch({ headless: true });
    for (const asset of storeAssets) {
      const metadata = await captureScreenshot(browser, {
        ...asset,
        url: `${siteUrl}${asset.route}`,
      });
      const { width, height } = metadata.viewport;
      log(`生成 ${asset.outputFile} ${width}x${height}`);
      await assertOpaque24BitPng(asset.outputPath, metadata.viewport);
    }
    await stopPreview(sitePreview);
  } finally {
    await browser?.close();
    await stopAllPreviews();
  }

  log(`完成：${storeAssets.map(({ outputPath }) => outputPath).join(", ")}`);
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
