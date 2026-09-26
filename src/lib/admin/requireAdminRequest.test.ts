import { describe, expect, it } from "vitest";

import {
  adminAuthErrorBody,
  looksLikeJwt,
  memberstackTokenFromRequest,
  requestWithBearerToken,
} from "./requireAdminRequest";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value";

describe("requireAdminRequest", () => {
  it("reads a bearer token from the Authorization header", () => {
    const request = new Request("https://example.com/watson", {
      headers: { Authorization: "Bearer header-token" },
    });
    expect(memberstackTokenFromRequest(request)).toBe("header-token");
  });

  it("does not treat a normal browser GET as authenticated without a JWT cookie", () => {
    const request = new Request("https://www.knititnow.com/courses/86?preview=true");
    expect(memberstackTokenFromRequest(request)).toBeNull();
    expect(
      memberstackTokenFromRequest(request, {
        get: () => undefined,
      }),
    ).toBeNull();
  });

  it("ignores Memberstack cookies that are not JWTs", () => {
    const request = new Request("https://www.knititnow.com/courses/86?preview=true");
    expect(
      memberstackTokenFromRequest(request, {
        get: (name) => (name === "_ms-mid" ? { value: "mem_abc123" } : undefined),
      }),
    ).toBeNull();
    expect(looksLikeJwt("mem_abc123")).toBe(false);
  });

  it("accepts a JWT from Memberstack _ms-mid / _ms_cookie cookies", () => {
    const request = new Request("https://www.knititnow.com/courses/86?preview=true");
    expect(
      memberstackTokenFromRequest(request, {
        get: (name) => (name === "_ms-mid" ? { value: JWT } : undefined),
      }),
    ).toBe(JWT);
    expect(
      memberstackTokenFromRequest(request, {
        get: (name) => (name === "_ms_cookie" ? { value: JWT } : undefined),
      }),
    ).toBe(JWT);
  });

  it("does not treat kin_admin_preview as a Memberstack JWT", () => {
    const request = new Request("https://www.knititnow.com/courses/86?preview=true");
    expect(
      memberstackTokenFromRequest(request, {
        get: (name) => (name === "kin_admin_preview" ? { value: JWT } : undefined),
      }),
    ).toBeNull();
  });

  it("uses the Memberstack session when Netlify basic auth occupies Authorization", () => {
    const request = new Request("https://knititnow.com/api/admin/pattern-errata/id/impact", {
      headers: {
        Authorization: "Basic YWRtaW46a25pdDc0MQ==",
        "X-Kin-Member-Token": JWT,
        Cookie: "_ms-mid=mem_not_a_jwt",
      },
    });
    expect(memberstackTokenFromRequest(request)).toBe(JWT);
    const authRequest = requestWithBearerToken(request, memberstackTokenFromRequest(request));
    expect(authRequest.headers.get("Authorization")).toBe(`Bearer ${JWT}`);
  });

  it("reads a JWT session cookie when neither bearer nor custom header is present", () => {
    const request = new Request("https://knititnow.com/api/admin/pattern-errata/id/impact", {
      headers: {
        Authorization: "Basic YWRtaW46a25pdDc0MQ==",
        Cookie: `_ms_cookie=${encodeURIComponent(JWT)}`,
      },
    });
    expect(memberstackTokenFromRequest(request, { get: () => undefined })).toBe(JWT);
  });

  it("falls back to Memberstack cookies when Authorization is absent", () => {
    const request = new Request("https://example.com/watson");
    const cookies = {
      get: (name: string) =>
        name === "memberstack" ? { value: "aaa.bbb.ccc-cookie-token-value" } : undefined,
    };
    expect(memberstackTokenFromRequest(request, cookies)).toBe("aaa.bbb.ccc-cookie-token-value");
  });

  it("builds an Authorization header from cookie tokens for requireAdmin", () => {
    const request = new Request("https://example.com/watson?q=sue");
    const token = memberstackTokenFromRequest(request, {
      get: (name: string) =>
        name === "memberstack_access_token" ? { value: "aaa.bbb.ccc-cookie-token-value" } : undefined,
    });
    const authRequest = requestWithBearerToken(request, token);
    expect(authRequest.headers.get("Authorization")).toBe("Bearer aaa.bbb.ccc-cookie-token-value");
  });

  it("forwards safe diagnostics on a 403 without identity values", () => {
    const body = adminAuthErrorBody({
      ok: false,
      status: 403,
      error: "Admin access required.",
      diagnostics: {
        env: {
          ADMIN_MEMBER_IDS: true,
          ADMIN_MEMBER_EMAILS: true,
          MEMBERSTACK_SECRET_KEY: true,
          MEMBERSTACK_SANDBOX_SECRET_KEY: true,
        },
        claimKeys: ["id", "sub", "type"],
        subjectExists: true,
        emailExists: false,
        allowlist: { idMatched: false, emailMatched: false },
      },
    });
    expect(body.ok).toBe(false);
    expect(body.diagnostics).toEqual(
      expect.objectContaining({
        subjectExists: true,
        emailExists: false,
        claimKeys: ["id", "sub", "type"],
      }),
    );
    expect(JSON.stringify(body)).not.toMatch(/mem_/);
    expect(JSON.stringify(body)).not.toMatch(/@/);
  });
});
