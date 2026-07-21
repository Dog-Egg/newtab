import packageJson from "../package.json";

export function validateAppVersion(version: string) {
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

  return version;
}

export const appVersion = validateAppVersion(packageJson.version);
