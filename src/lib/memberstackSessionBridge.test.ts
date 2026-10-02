import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  looksLikeMemberstackSessionJwt,
  memberstackJwtFromCookieHeader,
  memberstackSessionCookieAssignment,
  publishMemberstackSessionCookie,
  readStoredMemberstackJwt,
} from "./memberstackSessionBridge";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW1fc3VlIn0.signature-value";

describe("memberstack session cookie bridge", () => {
  it("reads a JWT from localStorage ahead of a non-token cookie", () => {
    expect(
      readStoredMemberstackJwt({
        localStorage: { getItem: () => JWT },
        cookie: "_ms-mid=mem_not_a_jwt",
      }),
    ).toBe(JWT);
  });

  it("reads a percent-encoded JWT cookie when localStorage has no session", () => {
    expect(
      readStoredMemberstackJwt({
        localStorage: { getItem: () => "mem_stale" },
        cookie: `_ms-mid=${encodeURIComponent(JWT)}`,
      }),
    ).toBe(JWT);
  });

  it("does not treat a member id as a session", () => {
    expect(looksLikeMemberstackSessionJwt("mem_abc")).toBe(false);
    expect(memberstackJwtFromCookieHeader("_ms-mid=mem_abc")).toBeNull();
    expect(memberstackSessionCookieAssignment("mem_abc", "knititnow.com")).toBeNull();
  });

  it("publishes the JWT on the Knit it Now parent domain", () => {
    const writes: string[] = [];
    const wrote = publishMemberstackSessionCookie(JWT, {
      hostname: "courses.knititnow.com",
      existingCookie: "",
      setCookie: (value) => writes.push(value),
    });
    expect(wrote).toBe(true);
    expect(writes[0]).toContain(`_ms_cookie=${encodeURIComponent(JWT)}`);
    expect(writes[0]).toContain("Domain=.knititnow.com");
    expect(writes[0]).toContain("SameSite=Lax");
    expect(writes[0]).toContain("Secure");
    expect(writes[0]).not.toContain("Domain=.netlify.app");
  });

  it("does not republish the same JWT", () => {
    const writes: string[] = [];
    const wrote = publishMemberstackSessionCookie(JWT, {
      hostname: "knititnow.com",
      existingCookie: `_ms_cookie=${encodeURIComponent(JWT)}`,
      setCookie: (value) => writes.push(value),
    });
    expect(wrote).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("keeps the cookie host-only off the production domain", () => {
    const assignment = memberstackSessionCookieAssignment(JWT, "deploy-preview.netlify.app");
    expect(assignment).not.toContain("Domain=");
    expect(assignment).toContain("Secure");
  });

  it("is installed from the site and course layouts", () => {
    const base = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
    const course = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
    expect(base).toContain("memberstackSessionBridge");
    expect(course).toContain("memberstackSessionBridge");
    expect(base).not.toContain("$memberstackDom?.init?.()");
  });
});
