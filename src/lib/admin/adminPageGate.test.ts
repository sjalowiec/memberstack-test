import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adminGateResponse, isAdminProtectedPath } from "./adminPageGate";
import type { RequireAdminResult } from "./requireAdminRequest";

const here = dirname(fileURLToPath(import.meta.url));

const signedOut: RequireAdminResult = {
  ok: false,
  status: 401,
  error: "Sign in required.",
};
const nonAdmin: RequireAdminResult = {
  ok: false,
  status: 403,
  error: "This account does not have admin access.",
};
const admin: RequireAdminResult = {
  ok: true,
  member: { id: "mem_admin", email: "admin@example.com" },
  mode: "verified",
};

describe("admin server gate", () => {
  it("leaves public pages outside the admin gate", () => {
    expect(isAdminProtectedPath("/")).toBe(false);
    expect(isAdminProtectedPath("/membership")).toBe(false);
    expect(isAdminProtectedPath("/patterns/hat")).toBe(false);
    expect(isAdminProtectedPath("/help-hub/casting-on")).toBe(false);
    expect(isAdminProtectedPath("/api/membership-status")).toBe(false);
    expect(isAdminProtectedPath("/administration")).toBe(false);
  });

  it("covers the dashboard, nested admin pages, and admin APIs", () => {
    expect(isAdminProtectedPath("/admin")).toBe(true);
    expect(isAdminProtectedPath("/admin/")).toBe(true);
    expect(isAdminProtectedPath("/admin/lessons")).toBe(true);
    expect(isAdminProtectedPath("/admin/help-hub-edit")).toBe(true);
    expect(isAdminProtectedPath("/api/admin")).toBe(true);
    expect(isAdminProtectedPath("/api/admin/videos")).toBe(true);
    expect(isAdminProtectedPath("/api/admin/bookshelf")).toBe(true);
  });

  it("blocks a signed-out visitor before any admin page or API data is returned", async () => {
    const page = adminGateResponse(signedOut, "/admin");
    const api = adminGateResponse(signedOut, "/api/admin/machines");
    expect(page?.status).toBe(401);
    expect(await page?.text()).toBe("Sign in required.");
    expect(page?.headers.get("cache-control")).toBe("no-store");
    expect(api?.status).toBe(401);
    expect(await api?.json()).toEqual({ ok: false, error: "Sign in required." });
  });

  it("blocks a signed-in non-admin", async () => {
    const page = adminGateResponse(nonAdmin, "/admin/lessons");
    const api = adminGateResponse(nonAdmin, "/api/admin/tips");
    expect(page?.status).toBe(403);
    expect(await page?.text()).toBe("Admin access required.");
    expect(api?.status).toBe(403);
    const body = await api?.json();
    expect(body.ok).toBe(false);
    expect(body).not.toHaveProperty("machines");
    expect(body).not.toHaveProperty("lessons");
  });

  it("lets an authorized admin continue to the page or endpoint", () => {
    expect(adminGateResponse(admin, "/admin")).toBeNull();
    expect(adminGateResponse(admin, "/admin/help-hub")).toBeNull();
    expect(adminGateResponse(admin, "/api/admin/lessons")).toBeNull();
  });

  it("wires the gate in middleware ahead of the public API passthrough", () => {
    const middleware = readFileSync(join(here, "..", "..", "middleware.ts"), "utf8");
    const gateAt = middleware.indexOf("isAdminProtectedPath(normalizedPathname)");
    const deniedAt = middleware.indexOf("if (denied) return denied;");
    const apiPassAt = middleware.indexOf('u.pathname.startsWith("/api/")');
    expect(gateAt).toBeGreaterThan(-1);
    expect(deniedAt).toBeGreaterThan(gateAt);
    expect(apiPassAt).toBeGreaterThan(deniedAt);
    expect(middleware).toContain("requireAdminForRequest");
  });
});
