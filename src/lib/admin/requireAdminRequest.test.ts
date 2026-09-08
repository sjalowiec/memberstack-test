import { describe, expect, it } from "vitest";

import { memberstackTokenFromRequest, requestWithBearerToken } from "./requireAdminRequest";

describe("requireAdminRequest", () => {
  it("reads a bearer token from the Authorization header", () => {
    const request = new Request("https://example.com/watson", {
      headers: { Authorization: "Bearer header-token" },
    });
    expect(memberstackTokenFromRequest(request)).toBe("header-token");
  });

  it("falls back to Memberstack cookies when Authorization is absent", () => {
    const request = new Request("https://example.com/watson");
    const cookies = {
      get: (name: string) =>
        name === "memberstack" ? { value: "aaa.bbb.ccc-cookie-token-value" } : undefined,
    };
    expect(memberstackTokenFromRequest(request, cookies)).toBe("aaa.bbb.ccc-cookie-token-value");
  });

  it("accepts a JWT from the Memberstack _ms_cookie", () => {
    const request = new Request("https://kin-dev.netlify.app/help-hub/preview");
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value";
    const cookies = {
      get: (name: string) => (name === "_ms_cookie" ? { value: jwt } : undefined),
    };
    expect(memberstackTokenFromRequest(request, cookies)).toBe(jwt);
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
});
