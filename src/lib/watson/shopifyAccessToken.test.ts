import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resetShopifyAccessTokenCache,
  resolveShopifyAccessToken,
  SHOPIFY_TOKEN_EXPIRY_SKEW_MS,
} from "./shopifyAccessToken";
import type { ShopifyAdminConfig } from "./shopifyEnv";

const staticConfig: ShopifyAdminConfig = {
  storeDomain: "vjzu11-86.myshopify.com",
  apiVersion: "2025-01",
  auth: { mode: "static", accessToken: "shpat_static" },
};

const clientConfig: ShopifyAdminConfig = {
  storeDomain: "vjzu11-86.myshopify.com",
  apiVersion: "2025-01",
  auth: {
    mode: "client_credentials",
    clientId: "client-id",
    clientSecret: "client-secret",
  },
};

afterEach(() => {
  resetShopifyAccessTokenCache();
});

describe("resolveShopifyAccessToken", () => {
  it("returns static token without calling Shopify", async () => {
    const fetchImpl = vi.fn();
    await expect(resolveShopifyAccessToken(staticConfig, fetchImpl)).resolves.toBe(
      "shpat_static",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests client credentials token with form body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_1", expires_in: 86399 }),
    });

    const token = await resolveShopifyAccessToken(clientConfig, fetchImpl);
    expect(token).toBe("tok_1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://vjzu11-86.myshopify.com/admin/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
    );
    expect(String(init.body)).toBe(
      "grant_type=client_credentials&client_id=client-id&client_secret=client-secret",
    );
  });

  it("reuses cached token until shortly before expiry", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok_cached", expires_in: 3600 }),
    });

    const first = await resolveShopifyAccessToken(clientConfig, fetchImpl, 1_000_000);
    const second = await resolveShopifyAccessToken(
      clientConfig,
      fetchImpl,
      1_000_000 + 30_000,
    );
    expect(first).toBe("tok_cached");
    expect(second).toBe("tok_cached");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes when within the expiry skew window", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok_old", expires_in: 120 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok_new", expires_in: 86399 }),
      });

    const issuedAt = 5_000_000;
    vi.spyOn(Date, "now").mockReturnValue(issuedAt);

    await resolveShopifyAccessToken(clientConfig, fetchImpl, issuedAt);
    // expiresAt = issuedAt + 120_000; usable until expiresAt - 60_000 = issuedAt + 60_000
    const refreshed = await resolveShopifyAccessToken(
      clientConfig,
      fetchImpl,
      issuedAt + 120_000 - SHOPIFY_TOKEN_EXPIRY_SKEW_MS,
    );

    expect(refreshed).toBe("tok_new");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces token endpoint errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_client"}',
    });

    await expect(resolveShopifyAccessToken(clientConfig, fetchImpl)).rejects.toThrow(
      /client credentials token request failed \(401\)/,
    );
  });
});
