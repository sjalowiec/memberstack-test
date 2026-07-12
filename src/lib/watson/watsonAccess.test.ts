import { describe, expect, it } from "vitest";

import {
  isWatsonRoute,
  watsonAccessDeniedHtml,
  watsonAccessDeniedResponse,
} from "./watsonAccess";

describe("watsonAccess", () => {
  it("matches /watson and nested routes", () => {
    expect(isWatsonRoute("/watson")).toBe(true);
    expect(isWatsonRoute("/watson/current")).toBe(true);
    expect(isWatsonRoute("/watson/members/123")).toBe(true);
    expect(isWatsonRoute("/watsonish")).toBe(false);
    expect(isWatsonRoute("/admin")).toBe(false);
  });

  it("returns HTML access-denied responses without customer data", async () => {
    const response = watsonAccessDeniedResponse(403, "Admin access required.");
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const html = await response.text();
    expect(html).toContain("Admin access required.");
    expect(html).not.toContain("legacy_members");
    expect(html).not.toContain("@");
  });

  it("uses distinct messages for logged-out and non-admin cases", () => {
    expect(watsonAccessDeniedHtml(401)).toContain("Sign in with an admin account");
    expect(watsonAccessDeniedHtml(403)).toContain("admin access");
  });
});
