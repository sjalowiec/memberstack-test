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
        name === "memberstack" ? { value: "cookie-token" } : undefined,
    };
    expect(memberstackTokenFromRequest(request, cookies)).toBe("cookie-token");
  });

  it("builds an Authorization header from cookie tokens for requireAdmin", () => {
    const request = new Request("https://example.com/watson?q=sue");
    const token = memberstackTokenFromRequest(request, {
      get: (name: string) =>
        name === "memberstack_access_token" ? { value: "cookie-token" } : undefined,
    });
    const authRequest = requestWithBearerToken(request, token);
    expect(authRequest.headers.get("Authorization")).toBe("Bearer cookie-token");
  });
});
