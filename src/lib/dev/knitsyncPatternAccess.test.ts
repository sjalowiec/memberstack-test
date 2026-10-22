import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isKnitSyncPatternProductionBlocked,
  isKnitSyncPatternRoute,
  KNITSYNC_PATTERN_PATH,
} from "./knitsyncPatternAccess";

describe("isKnitSyncPatternRoute", () => {
  it("matches the experiment path with or without a trailing slash", () => {
    expect(isKnitSyncPatternRoute(KNITSYNC_PATTERN_PATH)).toBe(true);
    expect(isKnitSyncPatternRoute(`${KNITSYNC_PATTERN_PATH}/`)).toBe(true);
  });

  it("does not match the row-counter experiment or other routes", () => {
    expect(isKnitSyncPatternRoute("/dev/bluetooth-row-counter")).toBe(false);
    expect(isKnitSyncPatternRoute("/patterns/")).toBe(false);
    expect(isKnitSyncPatternRoute("/dev/knitsync-pattern-extra")).toBe(false);
  });
});

describe("isKnitSyncPatternProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isKnitSyncPatternProductionBlocked("knititnow.com")).toBe(true);
    expect(isKnitSyncPatternProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isKnitSyncPatternProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, kin-dev, and Netlify previews", () => {
    expect(isKnitSyncPatternProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isKnitSyncPatternProductionBlocked("localhost")).toBe(false);
    expect(isKnitSyncPatternProductionBlocked("127.0.0.1")).toBe(false);
    expect(isKnitSyncPatternProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(isKnitSyncPatternProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
  });
});

describe("KnitSync pattern production gate", () => {
  it("is wired in middleware and the page, separate from pattern builders", () => {
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    const page = readFileSync(resolve("src/pages/dev/knitsync-pattern.astro"), "utf8");
    expect(middleware).toContain("isKnitSyncPatternRoute");
    expect(middleware).toContain("isKnitSyncPatternProductionBlocked");
    expect(page).toContain("isKnitSyncPatternProductionBlocked");
    expect(page).toContain("status: 404");
    expect(page).not.toContain("src/lib/patterns");
    expect(page).not.toContain("memberstack.com");
  });
});
