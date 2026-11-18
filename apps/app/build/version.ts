import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const versionTag = /^v(\d+\.\d+\.\d+)(?:-\d+-g[0-9a-f]+)?(?:-dirty)?$/;

export function validateAppVersion(version: string) {
  const components = version.split(".");
  const isValid =
    components.length <= 4 &&
    components.some((component) => component !== "0") &&
    components.every(
      (component) =>
        /^(0|[1-9]\d*)$/.test(component) && Number(component) <= 65_535,
    );

  if (!isValid) {
    throw new Error(
      `Version ${version} cannot be used as a browser manifest version. ` +
        "Expected one to four dot-separated integers between 0 and 65535, with at least one nonzero component.",
    );
  }

  return version;
}

export function resolveAppVersion(description: string) {
  const taggedVersion = versionTag.exec(description)?.[1];
  const isExactTag = taggedVersion !== undefined && description === `v${taggedVersion}`;

  return {
    version: validateAppVersion(taggedVersion ?? "0.0.0.1"),
    versionName: isExactTag ? taggedVersion : description || "dev",
  };
}

export function readAppVersion() {
  let description = "";
  try {
    description = execFileSync(
      "git",
      [
        "describe",
        "--tags",
        "--match", "v[0-9]*.[0-9]*.[0-9]*",
        "--exclude", "v*[^0-9.]*",
        "--exclude", "v*.*.*.*",
        "--always",
        "--dirty",
      ],
      {
        cwd: appRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  } catch {
    // Source archives can be built without Git metadata.
  }

  return resolveAppVersion(description);
}
