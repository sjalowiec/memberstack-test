import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("legacy renewal dry-run route", () => {
  it("is a Watson-admin GET that cannot write", () => {
    const route = fs.readFileSync(
      path.resolve("src/pages/api/watson/legacy-renewal-dry-run.ts"),
      "utf8",
    );
    expect(route).toContain("export const GET");
    expect(route).not.toContain("export const POST");
    expect(route).toContain("requireWatsonAdminJson");
    expect(route).toContain("dryRun: true");
    expect(route).toContain("productionWritesAllowed: false");
    expect(route).not.toMatch(/subscribeToList|addTag|confirm=LIVE/);
  });
});
