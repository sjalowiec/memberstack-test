import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson legacy paid-through API", () => {
  it("defines an admin-gated PATCH endpoint that updates only subscriptionexpiring", () => {
    const api = fs.readFileSync(
      path.resolve("src/pages/api/watson/members/[memberid]/paid-through.ts"),
      "utf8",
    );

    expect(api).toContain('export const prerender = false');
    expect(api).toContain("export const PATCH");
    expect(api).toContain("requireWatsonAdminJson");
    expect(api).toContain("updateLegacyPaidThrough");
    expect(api).toContain("paidThroughYmd");
    expect(api).toContain("Never writes expiration data to Memberstack");
  });

  it("wires the legacy customer page header to show and edit paid-through", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/customers/legacy/[memberid].astro"),
      "utf8",
    );
    const header = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerProfileHeader.astro"),
      "utf8",
    );
    const detail = fs.readFileSync(path.resolve("src/lib/watson/memberDetail.ts"), "utf8");

    expect(detail).toContain("subscriptionexpiring");
    expect(page).toContain("paidThroughUpdated");
    expect(header).toContain("Legacy paid-through");
    expect(header).toContain('type="date"');
    expect(header).toContain("/api/watson/members/");
    expect(header).toContain("paid-through");
    expect(header).toContain("window.confirm");
  });
});
