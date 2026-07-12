import { describe, expect, it } from "vitest";

import {
  createWatsonSessionToken,
  isWatsonPublicPath,
  isWatsonSessionAuthenticated,
  resolveWatsonAdminPassword,
  sanitizeWatsonLoginNextPath,
  verifyWatsonPassword,
  verifyWatsonSessionToken,
  WATSON_SESSION_MAX_AGE_SECONDS,
} from "./watsonAuth";

describe("watsonAuth", () => {
  it("resolves the configured admin password from env", () => {
    expect(resolveWatsonAdminPassword({ WATSON_ADMIN_PASSWORD: "  secret  " })).toBe("secret");
    expect(resolveWatsonAdminPassword({})).toBeNull();
  });

  it("allows only Watson login and auth API routes without a session", () => {
    expect(isWatsonPublicPath("/watson/login")).toBe(true);
    expect(isWatsonPublicPath("/api/watson/login")).toBe(true);
    expect(isWatsonPublicPath("/api/watson/logout")).toBe(true);
    expect(isWatsonPublicPath("/watson")).toBe(false);
    expect(isWatsonPublicPath("/api/watson/notes/1")).toBe(false);
  });

  it("verifies passwords with timing-safe comparison", () => {
    expect(verifyWatsonPassword("owner-pass", "owner-pass")).toBe(true);
    expect(verifyWatsonPassword("wrong-pass", "owner-pass")).toBe(false);
    expect(verifyWatsonPassword("owner-pass", "")).toBe(false);
  });

  it("creates and verifies a signed session token for 24 hours", () => {
    const now = Date.parse("2026-07-12T12:00:00.000Z");
    const token = createWatsonSessionToken("owner-pass", now);

    expect(verifyWatsonSessionToken(token, "owner-pass", now + 1000)).toBe(true);
    expect(
      verifyWatsonSessionToken(token, "owner-pass", now + WATSON_SESSION_MAX_AGE_SECONDS * 1000),
    ).toBe(false);
    expect(verifyWatsonSessionToken(token, "other-pass", now + 1000)).toBe(false);
    expect(verifyWatsonSessionToken("broken.token", "owner-pass", now + 1000)).toBe(false);
  });

  it("authenticates requests from a valid session cookie", () => {
    const password = "owner-pass";
    const now = Date.parse("2026-07-12T12:00:00.000Z");
    const token = createWatsonSessionToken(password, now);
    const cookies = {
      get: (name: string) => (name === "watson_session" ? { value: token } : undefined),
    };

    expect(isWatsonSessionAuthenticated(cookies, { password, now: now + 1000 })).toBe(true);
    expect(isWatsonSessionAuthenticated(cookies, { password: "other-pass", now: now + 1000 })).toBe(
      false,
    );
    expect(
      isWatsonSessionAuthenticated({ get: () => undefined }, { password, now: now + 1000 }),
    ).toBe(false);
  });

  it("sanitizes login redirect targets to Watson pages only", () => {
    expect(sanitizeWatsonLoginNextPath("/watson/current")).toBe("/watson/current");
    expect(sanitizeWatsonLoginNextPath("/watson/login")).toBe("/watson");
    expect(sanitizeWatsonLoginNextPath("//evil.example")).toBe("/watson");
    expect(sanitizeWatsonLoginNextPath("/admin")).toBe("/watson");
  });
});
