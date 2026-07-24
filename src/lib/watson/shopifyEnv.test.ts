import { describe, expect, it } from "vitest";

import { getShopifyAdminConfig, shopifyAdminBaseUrl } from "./shopifyEnv";

describe("shopifyEnv", () => {
  it("requires store domain and access token", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "",
    } as NodeJS.ProcessEnv);
    expect(result).toEqual(
      expect.objectContaining({ error: expect.stringContaining("SHOPIFY_STORE_DOMAIN") }),
    );
  });

  it("normalizes store domain and builds admin URL", () => {
    const result = getShopifyAdminConfig({
      SHOPIFY_STORE_DOMAIN: "https://vjzu11-86.myshopify.com/",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_test",
      SHOPIFY_API_VERSION: "2025-01",
    } as NodeJS.ProcessEnv);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.storeDomain).toBe("vjzu11-86.myshopify.com");
    expect(shopifyAdminBaseUrl(result)).toBe(
      "https://vjzu11-86.myshopify.com/admin/api/2025-01",
    );
  });
});
