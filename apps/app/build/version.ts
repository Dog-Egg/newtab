import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json";

type GitCommand = (args: string[]) => string;

export type AppVersion = {
  /** Version shown to people and exposed to the application. */
  version: string;
  /** Numeric version accepted by browser extension manifests. */
  manifestVersion: string;
  /** Whether this build should be identified as a development build. */
  development: boolean;
};

function assertValidManifestVersion(version: string) {
  const components = version.split(".");
  const isValid =
    components.length <= 4 &&
    components.every(
      (component) =>
        /^(0|[1-9]\d*)$/.test(component) && Number(component) <= 65_535,
    );

  if (!isValid) {
    throw new Error(
      `Package version ${version} cannot be used as a browser manifest version. ` +
        "Expected one to four dot-separated integers between 0 and 65535.",
    );
  }
}

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

function runGit(args: string[]) {
  return execFileSync("git", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getCommitVersion(git: GitCommand) {
  const commitTime = git(["show", "-s", "--format=%cI", "HEAD"]);
  const match = commitTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) {
    throw new Error(`Cannot parse the current Git commit time: ${commitTime}`);
  }

  return `dev.${match.slice(1).join("")}`;
}

export function resolveAppVersion({
  version,
  development,
  git = runGit,
}: {
  version: string;
  development: boolean;
  git?: GitCommand;
}): AppVersion {
  assertValidManifestVersion(version);

  return {
    version: development ? getCommitVersion(git) : version,
    manifestVersion: version,
    development,
  };
}

export const appVersion = resolveAppVersion(packageJson);
