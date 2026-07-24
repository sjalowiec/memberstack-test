import { describe, expect, it } from "vitest";

import { getShopifyAdminConfig, shopifyAdminBaseUrl } from "./shopifyEnv";

describe("shopifyEnv", () => {
  it("requires store domain", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "",
      SHOPIFY_CLIENT_ID: "",
      SHOPIFY_CLIENT_SECRET: "",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual(
      expect.objectContaining({ error: expect.stringContaining("SHOPIFY_STORE_DOMAIN") }),
    );
  });

  it("requires static token or both client credentials", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "vjzu11-86.myshopify.com",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual(
      expect.objectContaining({ error: expect.stringContaining("Shopify auth is not configured") }),
    );
  });

  it("rejects incomplete client credentials", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "vjzu11-86.myshopify.com",
      SHOPIFY_CLIENT_ID: "client-id-only",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET"),
      }),
    );
  });

  it("normalizes store domain and accepts legacy static token", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "https://vjzu11-86.myshopify.com/",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_test",
      SHOPIFY_API_VERSION: "2025-01",
    } as NodeJS.ProcessEnv);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.storeDomain).toBe("vjzu11-86.myshopify.com");
    expect(result.auth).toEqual({ mode: "static", accessToken: "shpat_test" });
    expect(shopifyAdminBaseUrl(result)).toBe(
      "https://vjzu11-86.myshopify.com/admin/api/2025-01",
    );
  });

  it("accepts Dev Dashboard client credentials when static token is absent", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "vjzu11-86.myshopify.com",
      SHOPIFY_CLIENT_ID: "cid",
      SHOPIFY_CLIENT_SECRET: "csecret",
    } as NodeJS.ProcessEnv);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.auth).toEqual({
      mode: "client_credentials",
      clientId: "cid",
      clientSecret: "csecret",
    });
  });

  it("prefers static token when both auth styles are set", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "vjzu11-86.myshopify.com",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_legacy",
      SHOPIFY_CLIENT_ID: "cid",
      SHOPIFY_CLIENT_SECRET: "csecret",
    } as NodeJS.ProcessEnv);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.auth).toEqual({ mode: "static", accessToken: "shpat_legacy" });
  });
});
