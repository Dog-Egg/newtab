import { describe, expect, it, vi } from "vitest";
import { resolveAppVersion } from "./version";

describe("resolveAppVersion", () => {
  it("uses the highest v* tag on a clean HEAD", () => {
    const git = vi.fn((args: string[]) =>
      args[0] === "status" ? "" : "v1.10.0\nv1.9.0",
    );

    expect(resolveAppVersion({ git })).toEqual({
      version: "1.10.0",
      manifestVersion: "1.10.0",
      source: "git-tag",
    });
  });

  it("uses a timestamp for a clean, untagged HEAD", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "status" || args[0] === "tag") return "";
      if (args[0] === "describe") return "v1.4.2";
      if (args[0] === "rev-list") return "3";
      return "";
    });

    expect(
      resolveAppVersion({ git, now: new Date(2026, 6, 21, 15, 30, 45) }),
    ).toEqual({
      version: "1.4.2-dev.20260721153045",
      manifestVersion: "1.4.2.4",
      source: "timestamp",
    });
  });

  it("uses a timestamp when the working tree is dirty", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "status") return " M manifest.ts";
      if (args[0] === "describe") return "v0.1.0";
      if (args[0] === "rev-list") return "0";
      return "";
    });

    expect(
      resolveAppVersion({ git, now: new Date(2026, 0, 2, 3, 4, 5) }),
    ).toEqual({
      version: "0.1.0-dev.20260102030405",
      manifestVersion: "0.1.0.1",
      source: "timestamp",
    });
  });

  it("rejects a tagged version that browsers cannot install", () => {
    const git = vi.fn((args: string[]) =>
      args[0] === "status" ? "" : "v1.2.3-beta.1",
    );

    expect(() => resolveAppVersion({ git })).toThrow(
      "cannot be used as a browser manifest version",
    );
  });

  it("starts development versions at 0.0.0 when there are no tags", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "status") return " M manifest.ts";
      if (args[0] === "describe") throw new Error("no tags");
      if (args[0] === "rev-list") return "12";
      return "";
    });

    expect(
      resolveAppVersion({ git, now: new Date(2026, 0, 2, 3, 4, 5) }),
    ).toEqual({
      version: "0.0.0-dev.20260102030405",
      manifestVersion: "0.0.0.13",
      source: "timestamp",
    });
  });
});

