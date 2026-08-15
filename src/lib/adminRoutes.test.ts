import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES, watsonAdminNavHref } from "./adminRoutes";

describe("watsonAdminNavHref", () => {
  it("keeps the production dashboard path outside localhost", () => {
    expect(ADMIN_ROUTES.dashboard).toBe("/admin");
    expect(watsonAdminNavHref("knititnow.com")).toBe("/admin");
    expect(watsonAdminNavHref("www.knititnow.com")).toBe("/admin");
    expect(watsonAdminNavHref("kin-dev.netlify.app")).toBe("/admin");
  });

  it("uses /admin/ on localhost", () => {
    expect(watsonAdminNavHref("localhost")).toBe("/admin/");
    expect(watsonAdminNavHref("127.0.0.1")).toBe("/admin/");
    expect(watsonAdminNavHref("example.netlify.app", { isViteDev: true })).toBe(
      "/admin/",
    );
  });
});
