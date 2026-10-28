import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWatsonSessionCookieHeader,
  createWatsonSessionToken,
  isWatsonSessionAuthenticated,
  sanitizeStaffLoginNextPath,
} from "../watson/watsonAuth";
import { hasStaffSession, isSameOriginStaffRequest, verifyStaffSessionToken } from "../../../netlify/functions/lib/staff-session.js";
import { requireAdmin } from "../../../netlify/functions/lib/admin-auth.js";
import { POST as login } from "../../pages/api/admin/login";
import { POST as logout } from "../../pages/api/admin/logout";
import { fetchAdminJson, fetchAdminHtml, getAdminAuthHeaders } from "./adminAuthClient";

const origin = "https://knititnow.com";
const password = "test-staff-password-only";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function formRequest(path: string, fields: Record<string, string>, from = origin) {
  return new Request(origin + path, {
    method: "POST", headers: { Origin: from }, body: new URLSearchParams(fields),
  });
}

describe("one staff session across production administration", () => {
  it("logs in, preserves an editor URL, authorizes page and API checks without Memberstack, and logs out", async () => {
    vi.stubEnv("WATSON_ADMIN_PASSWORD", password);
    const response = await login({ request: formRequest("/api/admin/login", { password, next: "/admin/marketing-calendar?view=week" }) } as never);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/admin/marketing-calendar?view=week");
    const setCookie = response.headers.get("Set-Cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    const cookie = setCookie.split(";")[0];
    const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
    expect(isWatsonSessionAuthenticated({ get: () => ({ value: token }) }, { password })).toBe(true);
    for (const path of ["/admin", "/admin/help-hub", "/watson/customers", "/api/admin/lessons", "/.netlify/functions/admin-membership-report"]) {
      const request = new Request(origin + path, { headers: { Cookie: cookie } });
      expect(hasStaffSession(request, { WATSON_ADMIN_PASSWORD: password })).toBe(true);
      expect(await requireAdmin(request, { WATSON_ADMIN_PASSWORD: password })).toMatchObject({ ok: true, mode: "staff" });
    }
    const saved = new Request(origin + "/api/admin/lessons", { method: "POST", headers: { Cookie: cookie, Origin: origin } });
    expect(await requireAdmin(saved, { WATSON_ADMIN_PASSWORD: password })).toMatchObject({ ok: true });
    const end = await logout({ request: formRequest("/api/admin/logout", {}) } as never);
    expect(end.headers.get("Location")).toBe("/admin/login");
    expect(end.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(hasStaffSession(new Request(origin + "/admin", { headers: { Cookie: end.headers.get("Set-Cookie")!.split(";")[0] } }), { WATSON_ADMIN_PASSWORD: password })).toBe(false);
  });

  it("rejects an incorrect password and cross-origin login/logout", async () => {
    vi.stubEnv("WATSON_ADMIN_PASSWORD", password);
    const wrong = await login({ request: formRequest("/api/admin/login", { password: "wrong", next: "/watson/customers" }) } as never);
    expect(wrong.status).toBe(302);
    expect(wrong.headers.get("Location")).toContain("/admin/login?error=1");
    expect(wrong.headers.get("Set-Cookie")).toBeNull();
    for (const handler of [login, logout]) {
      const rejected = await handler({ request: formRequest("/api/admin/login", { password }, "https://other.example") } as never);
      expect(rejected.status).toBe(403);
    }
  });

  it("fails closed for missing configuration, forged, expired, malformed, and rotated sessions", async () => {
    const token = createWatsonSessionToken(password);
    const cookie = `watson_session=${encodeURIComponent(token)}`;
    const request = new Request(origin + "/admin", { headers: { Cookie: cookie, "X-Kin-Staff-Session": "cookie" } });
    expect(hasStaffSession(request, {})).toBe(false);
    expect(hasStaffSession(request, { WATSON_ADMIN_PASSWORD: "rotated" })).toBe(false);
    expect(hasStaffSession(new Request(origin + "/admin", { headers: { "X-Kin-Staff-Session": "cookie" } }), { WATSON_ADMIN_PASSWORD: password })).toBe(false);
    for (const bad of [token + ".extra", "forged.signature", "%bad", ""]) expect(verifyStaffSessionToken(bad, password)).toBe(false);
    expect(verifyStaffSessionToken(createWatsonSessionToken(password, 0), password)).toBe(false);
    const unsafe = new Request(origin + "/api/admin/lessons", { method: "POST", headers: { Cookie: cookie, Origin: "https://other.example" } });
    expect(await requireAdmin(unsafe, { WATSON_ADMIN_PASSWORD: password })).toMatchObject({ ok: false, status: 403 });
    expect(isSameOriginStaffRequest(new Request(origin + "/api/admin/lessons", { method: "POST" }))).toBe(false);
    vi.stubEnv("WATSON_ADMIN_PASSWORD", "");
    expect((await login({ request: formRequest("/api/admin/login", { password }) } as never)).status).toBe(503);
  });

  it("keeps redirects inside the two staff areas and out of login loops", () => {
    for (const path of ["https://evil.example", "//evil.example", "/admin/login", "/watson/login/", "/administration", "/admin/../../membership", "/admin/%2e%2e/membership", "/admin/%5cevil", "/admin\n"]) expect(sanitizeStaffLoginNextPath(path)).toBe("/admin");
    expect(sanitizeStaffLoginNextPath("/watson/customers?q=test")).toBe("/watson/customers?q=test");
    expect(sanitizeStaffLoginNextPath("/admin/help-hub-edit?id=12")).toBe("/admin/help-hub-edit?id=12");
  });

  it("sends cookie-authenticated editor and preview requests without waiting for a customer login", async () => {
    vi.stubGlobal("document", { querySelector: () => ({}) });
    expect(await getAdminAuthHeaders()).toEqual({ "X-Kin-Staff-Session": "cookie" });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }));
    expect((await fetchAdminJson("/api/admin/lessons", { method: "POST", body: {}, fetchImpl })).ok).toBe(true);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ credentials: "same-origin" });
    const htmlFetch = vi.fn(async () => new Response("<p>Preview</p>"));
    expect((await fetchAdminHtml("/help-hub/preview", { method: "POST", body: {}, fetchImpl: htmlFetch })).ok).toBe(true);
  });
});
