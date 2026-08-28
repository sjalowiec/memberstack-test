import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("POST /api/admin/machine-sales-image", () => {
  const source = fs.readFileSync(
    path.resolve("src/pages/api/admin/machine-sales-image.ts"),
    "utf8",
  );

  it("persists with the request hostname and blocks production writes", () => {
    expect(source).toContain("persistMachineSalesImage");
    expect(source).not.toContain("writeMachineSalesImage");
    expect(source).toContain("isMachineSalesDevWriteAllowed");
    expect(source).toContain("new URL(request.url).hostname");
    expect(source).toContain("productionBlockedResponse");
  });
});

describe("POST /api/admin/machine-sales", () => {
  const source = fs.readFileSync(path.resolve("src/pages/api/admin/machine-sales.ts"), "utf8");

  it("persists listing JSON with the request hostname instead of a raw filesystem write", () => {
    expect(source).toContain("persistMachineSalesListings");
    expect(source).not.toContain("writeMachineSalesListings");
    expect(source).toContain("isMachineSalesDevWriteAllowed");
    expect(source).toContain("new URL(request.url).hostname");
    expect(source).toContain("productionBlockedResponse");
  });
});
