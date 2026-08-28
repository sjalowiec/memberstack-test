import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("POST /api/admin/machine-sales-image", () => {
  const source = fs.readFileSync(
    path.resolve("src/pages/api/admin/machine-sales-image.ts"),
    "utf8",
  );

  it("requires reporting-level admin auth before persisting an image", () => {
    expect(source).toContain("requireAdminForRequest");
    expect(source).not.toContain("requireVerifiedMemberForRequest");
    expect(source).toContain("persistMachineSalesImage");
    expect(source).not.toContain("writeMachineSalesImage");
    expect(source).not.toContain("isMachineSalesDevWriteAllowed");
    expect(source).not.toContain("productionBlockedResponse");
    expect(source).toContain("new URL(request.url).hostname");
  });
});

describe("POST /api/admin/machine-sales", () => {
  const source = fs.readFileSync(path.resolve("src/pages/api/admin/machine-sales.ts"), "utf8");

  it("requires reporting-level admin auth before save or delete", () => {
    expect(source).toContain("requireAdminForRequest");
    expect(source).not.toContain("requireVerifiedMemberForRequest");
    expect(source).toContain("persistMachineSalesListings");
    expect(source).not.toContain("writeMachineSalesListings");
    expect(source).not.toContain("isMachineSalesDevWriteAllowed");
    expect(source).not.toContain("productionBlockedResponse");
    expect(source).toContain("applyListingDelete");
    expect(source).toContain('mode === "delete"');
    expect(source).not.toContain("unlink");
    expect(source).not.toContain("rmSync");
  });
});

describe("Machines for Sale admin page", () => {
  const page = fs.readFileSync(path.resolve("src/pages/admin/shop-machines.astro"), "utf8");

  it("sends admin auth on mutations and no longer has a publish step", () => {
    expect(page).toContain("getAdminAuthHeaders");
    expect(page).toContain("mutationHeaders");
    expect(page).not.toContain("Publish to Production");
    expect(page).not.toContain("/api/admin/machine-sales-publish");
    expect(page).not.toContain("GITHUB_TOKEN");
    expect(page).not.toContain("GITHUB_REPO");
  });
});
