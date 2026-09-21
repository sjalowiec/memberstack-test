import { describe, expect, it, vi } from "vitest";

import { MEMBER_SAVED_PATTERN_COUNT_SQL } from "./memberSavedPatterns";
import {
  LEGACY_STRIPE_CUSTOMER_ID_SQL,
  loadLegacyStripeCustomerId,
  loadMemberAccountRepairPageData,
  loadMemberAccountRepairStatusExtras,
} from "./memberAccountRepairLoad";

describe("memberAccountRepairLoad", () => {
  it("returns a blank standalone form when opened without customer ids", async () => {
    const page = await loadMemberAccountRepairPageData({ get: () => null });
    expect(page.prefilled).toBe(false);
    expect(page.loadError).toBeNull();
    expect(page.backHref).toBeNull();
    expect(page.detected).toEqual([]);
    expect(Object.values(page.values).every((value) => value === "")).toBe(true);
  });

  it("loads stripe customer id and saved-pattern count from Watson read-only queries", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === LEGACY_STRIPE_CUSTOMER_ID_SQL) {
        return [{ stripcustomerid: "cus_legacy" }];
      }
      if (sql === MEMBER_SAVED_PATTERN_COUNT_SQL) {
        return [{ pattern_count: "4" }];
      }
      return [];
    });

    const extras = await loadMemberAccountRepairStatusExtras("M1", { queryFn });
    expect(extras.stripeCustomerId).toBe("cus_legacy");
    expect(extras.savedPatternCount).toBe(4);
    expect(queryFn.mock.calls.every(([sql]) => typeof sql === "string" && sql.trim().toUpperCase().startsWith("SELECT"))).toBe(
      true,
    );
  });

  it("does not treat extra lookup failures as missing data", async () => {
    const queryFn = vi.fn(async () => {
      throw new Error("watson unavailable");
    });

    await expect(loadLegacyStripeCustomerId("M1", queryFn)).resolves.toBeNull();
    const extras = await loadMemberAccountRepairStatusExtras("M1", { queryFn });
    expect(extras.stripeCustomerId).toBeNull();
    expect(extras.savedPatternCount).toBeNull();
  });

  it("does not issue mutation SQL while loading extras", async () => {
    const queryFn = vi.fn(async () => []);
    await loadMemberAccountRepairStatusExtras("M1", { queryFn });
    for (const [sql] of queryFn.mock.calls) {
      expect(String(sql)).not.toMatch(/\b(INSERT|UPDATE|DELETE|UPSERT|ALTER|DROP)\b/i);
    }
  });
});
