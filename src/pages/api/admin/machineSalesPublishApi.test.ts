import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("POST /api/admin/machine-sales-publish", () => {
  const source = fs.readFileSync(
    path.resolve("src/pages/api/admin/machine-sales-publish.ts"),
    "utf8",
  );

  it("blocks production hosts and requires a signed-in member before writing", () => {
    expect(source).toContain("isMachineSalesPublishAllowed");
    expect(source).toContain("productionBlockedResponse");
    expect(source).toContain("requireVerifiedMemberForRequest");
    expect(source).not.toContain("requireAdminForRequest");
    expect(source).toContain('MACHINE_SALES_PUBLISH_CONFIRM');
    expect(source).toContain("planMachineSalesPublish");
    expect(source).toContain("hostname, env: adminEnv");
    expect(source).toContain("publishMachineSalesToProduction");
  });

  it("does not mention GitHub credentials in the shop-machines admin page", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/admin/shop-machines.astro"),
      "utf8",
    );
    expect(page).not.toContain("GITHUB_TOKEN");
    expect(page).not.toContain("GITHUB_REPO");
    expect(page).toContain("Publish to Production");
    expect(page).toContain("/api/admin/machine-sales-publish");
  });
});
