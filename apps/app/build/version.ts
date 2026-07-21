import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type GitCommand = (args: string[]) => string;

export type AppVersion = {
  /** Version shown to people and exposed to the application. */
  version: string;
  /** Numeric version accepted by browser extension manifests. */
  manifestVersion: string;
  source: "git-tag" | "timestamp";
};

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

function runGit(args: string[]) {
  return execFileSync("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function assertValidManifestVersion(version: string, tag: string) {
  const components = version.split(".");
  const isValid =
    components.length <= 4 &&
    components.every(
      (component) =>
        /^(0|[1-9]\d*)$/.test(component) && Number(component) <= 65_535,
    );

  if (!isValid) {
    throw new Error(
      `Git tag ${tag} cannot be used as a browser manifest version. ` +
        "Expected v followed by one to four dot-separated integers between 0 and 65535.",
    );
  }
}

function getGitOutput(git: GitCommand, args: string[]) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function getDevelopmentBaseVersion(tag: string) {
  if (!tag) return "0.0.0";

  const version = tag.slice(1);
  assertValidManifestVersion(version, tag);
  const components = version.split(".");

  if (components.length > 3) {
    throw new Error(
      `Git tag ${tag} leaves no numeric component for development builds. ` +
        "Use one to three version components for release tags.",
    );
  }

  return [...components, ...Array(3 - components.length).fill("0")].join(".");
}

export function resolveAppVersion({
  git = runGit,
  now = new Date(),
}: {
  git?: GitCommand;
  now?: Date;
} = {}): AppVersion {
  const isClean = git(["status", "--porcelain"]) === "";

  if (isClean) {
    const tag = getGitOutput(git, [
      "tag",
      "--points-at",
      "HEAD",
      "--list",
      "v*",
      "--sort=-v:refname",
    ])
      .split("\n")
      .find(Boolean);

    if (tag) {
      const version = tag.slice(1);
      assertValidManifestVersion(version, tag);
      return { version, manifestVersion: version, source: "git-tag" };
    }
  }

  const timestamp = formatTimestamp(now);
  const baseTag = getGitOutput(git, [
    "describe",
    "--tags",
    "--match",
    "v[0-9]*",
    "--abbrev=0",
  ]);
  const baseVersion = getDevelopmentBaseVersion(baseTag);
  const commitRange = baseTag ? `${baseTag}..HEAD` : "HEAD";
  const commitCount = Number(
    getGitOutput(git, ["rev-list", commitRange, "--count"]),
  );
  const buildNumber = commitCount + 1;

  if (!Number.isSafeInteger(buildNumber) || buildNumber > 65_535) {
    throw new Error(
      `Development build number ${buildNumber} is not valid in a browser manifest version.`,
    );
  }

  return {
    version: `${baseVersion}-dev.${timestamp}`,
    manifestVersion: `${baseVersion}.${buildNumber}`,
    source: "timestamp",
  };
}

export const appVersion = resolveAppVersion();

