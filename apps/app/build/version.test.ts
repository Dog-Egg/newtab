import { describe, expect, it } from "vitest";
import { resolveAppVersion, validateAppVersion } from "./version";

describe("validateAppVersion", () => {
  it("accepts a numeric version", () => {
    expect(validateAppVersion("2.0.0")).toBe("2.0.0");
  });

  it.each(["1.2.3-beta.1", "0.0.0", "1.65536.0"])("rejects %s", (version) => {
    expect(() => validateAppVersion(version)).toThrow(
      "cannot be used as a browser manifest version",
    );
  });
});

describe("resolveAppVersion", () => {
  it("uses the numeric version when the Git description is an exact tag", () => {
    expect(resolveAppVersion("v0.4.0")).toEqual({
      version: "0.4.0",
      versionName: "0.4.0",
    });
  });

  it.each(["v0.4.0-14-g984ebf7", "v0.4.0-dirty"])(
    "keeps the Git description %s for development builds",
    (description) => {
      expect(resolveAppVersion(description)).toEqual({
        version: "0.4.0",
        versionName: description,
      });
    },
  );

  it.each(["984ebf7", ""])("supports development builds with no tag (%s)", (description) => {
    expect(resolveAppVersion(description)).toEqual({
      version: "0.0.0.1",
      versionName: description || "dev",
    });
  });
});
