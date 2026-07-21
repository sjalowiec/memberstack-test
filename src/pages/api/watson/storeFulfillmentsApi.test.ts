import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson store fulfillments API routes", () => {
  it("defines session-gated member fulfillments endpoints", () => {
    const memberFulfillmentsApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/members/[memberid]/fulfillments.ts"),
      "utf8",
    );
    const fulfillmentItemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/fulfillments/[id].ts"),
      "utf8",
    );

    expect(memberFulfillmentsApi).toContain("requireWatsonAdminJson");
    expect(memberFulfillmentsApi).toContain("export const GET");
    expect(memberFulfillmentsApi).toContain("export const POST");
    expect(memberFulfillmentsApi).toContain("createStoreFulfillment");
    expect(memberFulfillmentsApi).toContain("export const prerender = false");

    expect(fulfillmentItemApi).toContain("requireWatsonAdminJson");
    expect(fulfillmentItemApi).toContain("export const PATCH");
    expect(fulfillmentItemApi).toContain("export const DELETE");
    expect(fulfillmentItemApi).toContain("updateStoreFulfillment");
    expect(fulfillmentItemApi).toContain("deleteStoreFulfillment");
  });

  it("keeps store fulfillments under Watson API routes only", () => {
    const memberApiPath = path.resolve(
      "src/pages/api/watson/members/[memberid]/fulfillments.ts",
    );
    const itemApiPath = path.resolve("src/pages/api/watson/fulfillments/[id].ts");
    expect(memberApiPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);
    expect(itemApiPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);

    const memberApi = fs.readFileSync(memberApiPath, "utf8");
    expect(memberApi).toContain("requireWatsonAdminJson");
    expect(memberApi).not.toContain("shopify.fulfill");
    expect(memberApi).not.toContain("/membership");
  });
});
