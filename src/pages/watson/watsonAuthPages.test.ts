import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson auth routes", () => {
  it("defines a password login page and auth API routes", () => {
    const loginPage = fs.readFileSync(path.resolve("src/pages/watson/login.astro"), "utf8");
    const loginApi = fs.readFileSync(path.resolve("src/pages/api/watson/login.ts"), "utf8");
    const logoutApi = fs.readFileSync(path.resolve("src/pages/api/watson/logout.ts"), "utf8");
    const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");
    const shell = fs.readFileSync(
      path.resolve("src/components/watson/WatsonPageShell.astro"),
      "utf8",
    );

    expect(loginPage).toContain('action="/api/watson/login"');
    expect(loginPage).toContain("Incorrect password.");
    expect(loginPage).toContain('type="password"');
    expect(loginPage).not.toContain("Memberstack");
    expect(loginPage).not.toContain("WATSON_ADMIN_PASSWORD");

    expect(loginApi).toContain("verifyWatsonPassword");
    expect(loginApi).toContain("buildWatsonSessionCookieHeader");
    expect(loginApi).toContain("resolveWatsonAdminPassword");
    expect(loginApi).not.toContain("requireAdminForRequest");

    expect(logoutApi).toContain("buildWatsonLogoutCookieHeader");
    expect(logoutApi).toContain('Location: "/watson/login"');

    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
    expect(middleware).not.toContain("requireAdminForRequest");
    expect(middleware).not.toContain("watsonAccessDeniedResponse");

    expect(shell).toContain('action="/api/watson/logout"');
    expect(shell).toContain("Logout");
  });
});
