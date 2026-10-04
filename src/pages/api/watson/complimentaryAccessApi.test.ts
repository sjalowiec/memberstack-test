import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson complimentary access API", () => {
  it("defines an admin-gated PATCH that updates only the complimentary date", () => {
    const api = fs.readFileSync(
      path.resolve("src/pages/api/watson/memberstack/[memberstackId]/complimentary-access.ts"),
      "utf8",
    );
    const header = fs.readFileSync(
      path.resolve("src/components/watson/WatsonCustomerProfileHeader.astro"),
      "utf8",
    );

    expect(api).toContain("export const PATCH");
    expect(api).toContain("requireWatsonAdminJson");
    expect(api).toContain("updateComplimentaryAccessThrough");
    expect(api).toContain("accessThroughYmd");
    expect(api).toContain("Does not change legacy paid-through");
    expect(header).toContain("COMPLIMENTARY_ACCESS_THROUGH_LABEL");
    expect(header).toContain("data-complimentary-access");
    expect(header).toContain("/api/watson/memberstack/");
    expect(header).toContain("complimentary-access");
    expect(header).toContain("LEGACY_RECORD_PAID_THROUGH_LABEL");
  });
});
