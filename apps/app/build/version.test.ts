import { describe, expect, it, vi } from "vitest";
import { resolveAppVersion } from "./version";

describe("resolveAppVersion", () => {
  it("uses the current commit time for a development build", () => {
    const git = vi.fn(() => "2026-07-21T14:45:09+08:00");

    expect(
      resolveAppVersion({ version: "1.4.2", development: true, git }),
    ).toEqual({
      version: "dev.20260721144509",
      manifestVersion: "1.4.2",
      development: true,
    });
    expect(git).toHaveBeenCalledWith([
      "show",
      "-s",
      "--format=%cI",
      "HEAD",
    ]);
  });

  it("uses the package version for a release build", () => {
    const git = vi.fn();

    expect(
      resolveAppVersion({ version: "2.0.0", development: false, git }),
    ).toEqual({
      version: "2.0.0",
      manifestVersion: "2.0.0",
      development: false,
    });
    expect(git).not.toHaveBeenCalled();
  });

  it("rejects a package version that browsers cannot install", () => {
    expect(() =>
      resolveAppVersion({
        version: "1.2.3-beta.1",
        development: true,
        git: vi.fn(),
      }),
    ).toThrow("cannot be used as a browser manifest version");
  });

  it("rejects an invalid Git commit time", () => {
    expect(() =>
      resolveAppVersion({
        version: "1.2.3",
        development: true,
        git: () => "unknown",
      }),
    ).toThrow("Cannot parse the current Git commit time");
  });
});
