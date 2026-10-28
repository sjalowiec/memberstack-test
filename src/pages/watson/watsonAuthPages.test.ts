import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared production staff entry", () => {
  it("uses one password form and no member SDK on the login document", () => {
    const form = fs.readFileSync("src/pages/admin/login.astro", "utf8");
    expect(form).toContain('action="/api/admin/login"');
    expect(form).toContain('type="password"');
    expect(form).not.toContain("BaseLayout");
    expect(form).not.toContain("memberstack");
    expect(form).not.toContain("WATSON_ADMIN_PASSWORD");
    expect(fs.readFileSync("src/pages/watson/login.astro", "utf8")).toContain("/admin/login?");
  });
  it("gives both workspaces a way back to the full directory and shared logout", () => {
    const layout = fs.readFileSync("src/layouts/BaseLayout.astro", "utf8");
    expect(layout).toContain('href="/admin"');
    expect(layout).toContain('action="/api/admin/logout"');
    const directory = fs.readFileSync("src/pages/admin/index.astro", "utf8");
    for (const target of ["/watson/customers", "/watson/tip-of-the-week", "/watson/whats-new", "/admin/marketing-calendar", "/admin/help-hub"]) {
      expect(directory).toContain(target);
    }
    expect(directory).not.toContain("kin-dev.netlify.app");
  });
});
