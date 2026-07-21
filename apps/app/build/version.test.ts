import { describe, expect, it } from "vitest";
import { validateAppVersion } from "./version";

describe("validateAppVersion", () => {
  it("uses the package version", () => {
    expect(validateAppVersion("2.0.0")).toBe("2.0.0");
  });

  it("rejects a package version that browsers cannot install", () => {
    expect(() => validateAppVersion("1.2.3-beta.1")).toThrow(
      "cannot be used as a browser manifest version",
    );
  });
});
