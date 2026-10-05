import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("legacy renewal explicit test route", () => {
  it("preflights on GET and confirms a single hardcoded address on POST", () => {
    const route = fs.readFileSync(
      path.resolve("src/pages/api/watson/legacy-renewal-test.ts"),
      "utf8",
    );
    const lib = fs.readFileSync(
      path.resolve("src/lib/watson/legacyRenewalSingleContactTest.ts"),
      "utf8",
    );
    expect(route).toContain("export const GET");
    expect(route).toContain("export const POST");
    expect(route).toContain("requireWatsonAdminJson");
    expect(route).toContain('confirm") !== "TEST"');
    expect(route).toContain("isProductionActiveCampaignWriteRuntime");
    expect(route).not.toMatch(/searchParams\.get\("email"\)|request\.json/);
    expect(lib).toContain('export const LEGACY_RENEWAL_TEST_EMAIL = "nosub1@knititnow.com"');
    expect(lib).not.toContain("runLegacyRenewalReminders");
  });
});
