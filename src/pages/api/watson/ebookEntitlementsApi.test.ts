import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/watson/watsonApiAuth", () => ({
  requireWatsonAdminJson: vi.fn(),
  readWatsonJsonBody: vi.fn(),
  watsonJsonResponse: (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

import { GET as catalogGet } from "./ebooks/catalog";
import { requireWatsonAdminJson } from "../../../lib/watson/watsonApiAuth";

function apiContext(url: string, params: Record<string, string> = {}) {
  return {
    request: new Request(url),
    cookies: { get: () => undefined },
    params,
  } as never;
}

describe("Watson ebook entitlement API routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("gates catalog, grant, and revoke routes with Watson admin auth", () => {
    const catalog = fs.readFileSync(
      path.resolve("src/pages/api/watson/ebooks/catalog.ts"),
      "utf8",
    );
    const legacy = fs.readFileSync(
      path.resolve("src/pages/api/watson/customers/legacy/[memberid]/ebook-entitlements.ts"),
      "utf8",
    );
    const memberstack = fs.readFileSync(
      path.resolve(
        "src/pages/api/watson/customers/memberstack/[memberstackId]/ebook-entitlements.ts",
      ),
      "utf8",
    );
    const revoke = fs.readFileSync(
      path.resolve("src/pages/api/watson/ebook-entitlements/[id]/revoke.ts"),
      "utf8",
    );

    for (const source of [catalog, legacy, memberstack, revoke]) {
      expect(source).toContain("requireWatsonAdminJson");
      expect(source).toContain("export const prerender = false");
    }
    expect(legacy).toContain("grantCustomerEbook");
    expect(memberstack).toContain("grantCustomerEbook");
    expect(revoke).toContain("revokeEbookEntitlement");
    expect(catalog).not.toContain("legacy_store_transactions");
    expect(legacy).not.toContain("INSERT INTO legacy_store_transactions");
  });

  it("rejects an unauthorized administrator", async () => {
    vi.mocked(requireWatsonAdminJson).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Sign in required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await catalogGet(
      apiContext("https://example.com/api/watson/ebooks/catalog"),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Sign in required.");
  });
});
