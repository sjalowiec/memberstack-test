import { describe, expect, it, vi } from "vitest";
import { COMPLIMENTARY_MEMBERSHIPS, FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../config/memberships";
import { formatMemberstackUnixDate } from "./membership/accountMembershipPanel";
import { evaluateMemberAccessForRecord, loadLegacyPaidThroughYmdForEmail } from "./memberAccessServer";

vi.mock("./watson/customerIdentifier", () => ({
  resolveLegacyLinkByMemberstackEmail: vi.fn(),
}));

import { resolveLegacyLinkByMemberstackEmail } from "./watson/customerIdentifier";

const LEGACY_FREE = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const COMPLIMENTARY = COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;
const TODAY = "2026-07-22";

function record(planId: string, email = "legacy@example.com") {
  return {
    id: "mem_1",
    auth: { email },
    planConnections: [{ planId, status: "ACTIVE", active: true }],
  };
}

describe("loadLegacyPaidThroughYmdForEmail", () => {
  it("returns the unique Watson paid-through date", async () => {
    vi.mocked(resolveLegacyLinkByMemberstackEmail).mockResolvedValue({
      status: "unique",
      member: { subscriptionexpiring: "2026-12-01" },
    } as never);
    await expect(loadLegacyPaidThroughYmdForEmail("legacy@example.com")).resolves.toBe(
      "2026-12-01",
    );
  });

  it("returns null for missing, ambiguous, or empty dates", async () => {
    vi.mocked(resolveLegacyLinkByMemberstackEmail).mockResolvedValue({ status: "none" });
    await expect(loadLegacyPaidThroughYmdForEmail("none@example.com")).resolves.toBe(null);

    vi.mocked(resolveLegacyLinkByMemberstackEmail).mockResolvedValue({
      status: "ambiguous",
      members: [],
    });
    await expect(loadLegacyPaidThroughYmdForEmail("dup@example.com")).resolves.toBe(null);

    vi.mocked(resolveLegacyLinkByMemberstackEmail).mockResolvedValue({
      status: "unique",
      member: { subscriptionexpiring: null },
    } as never);
    await expect(loadLegacyPaidThroughYmdForEmail("nodate@example.com")).resolves.toBe(null);
  });
});

describe("evaluateMemberAccessForRecord", () => {
  it("grants paid membership and still records the Watson lookup", async () => {
    const load = vi.fn(async () => "2027-11-30");
    const result = await evaluateMemberAccessForRecord(record(PAID), {
      loadPaidThroughYmd: load,
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.legacyPaidThroughLookup).toBe("found");
    expect(result.legacyPaidThroughYmd).toBe("2027-11-30");
    expect(result.serverConfirmedPaidAccess).toBe(true);
    expect(result.legacyLookupFailed).toBe(false);
  });

  it("keeps paid access when Watson finds no date", async () => {
    const result = await evaluateMemberAccessForRecord(record(PAID), {
      loadPaidThroughYmd: async () => null,
      todayYmd: TODAY,
    });
    expect(result).toMatchObject({
      hasMemberAccess: true,
      legacyPaidThroughLookup: "not_found",
      legacyPaidThroughYmd: null,
      serverConfirmedPaidAccess: true,
      legacyLookupFailed: false,
    });
  });

  it("keeps paid access when Watson is unavailable and does not call that not found", async () => {
    const result = await evaluateMemberAccessForRecord(record(PAID), {
      loadPaidThroughYmd: async () => {
        throw new Error("db down");
      },
      todayYmd: TODAY,
    });
    expect(result).toMatchObject({
      hasMemberAccess: true,
      legacyPaidThroughLookup: "not_loaded",
      legacyLookupFailed: false,
      serverConfirmedPaidAccess: true,
    });
  });

  it("reports an annual interval for a trialing paid plan beside a free legacy plan", async () => {
    const result = await evaluateMemberAccessForRecord(
      {
        id: "mem_trial",
        auth: { email: "legacy@example.com" },
        planConnections: [
          { planId: "pln_course-lk150-patterning-nw00gk6", status: "ACTIVE", active: true },
          {
            planId: PAID,
            status: "TRIALING",
            active: true,
            payment: { priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId },
          },
          { planId: LEGACY_FREE, status: "ACTIVE", active: true },
        ],
      },
      { loadPaidThroughYmd: async () => "2027-11-30", todayYmd: TODAY },
    );
    expect(result).toMatchObject({
      hasMemberAccess: true,
      legacyPaidThroughLookup: "found",
      serverConfirmedPaidAccess: true,
      serverConfirmedPaidBillingInterval: "annual",
      serverConfirmedPaidRenewsLabel: null,
    });
  });

  it("uses the Stripe next billing date and not the Watson paid-through date", async () => {
    const nextBillingDate = Math.floor(Date.UTC(2027, 10, 30, 12) / 1000);
    const result = await evaluateMemberAccessForRecord(
      {
        id: "mem_trial",
        auth: { email: "legacy@example.com" },
        planConnections: [
          {
            planId: PAID,
            status: "TRIALING",
            active: true,
            payment: {
              priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
              nextBillingDate,
            },
          },
          { planId: LEGACY_FREE, status: "ACTIVE", active: true },
        ],
      },
      { loadPaidThroughYmd: async () => "2026-01-15", todayYmd: TODAY },
    );
    expect(result.serverConfirmedPaidRenewsLabel).toBe(formatMemberstackUnixDate(nextBillingDate));
    expect(result.serverConfirmedPaidRenewsLabel).not.toBe("January 15, 2026");
    expect(result.legacyPaidThroughYmd).toBe("2026-01-15");
  });

  it("grants active free legacy when paid-through is in the future", async () => {
    const result = await evaluateMemberAccessForRecord(record(LEGACY_FREE), {
      loadPaidThroughYmd: async () => "2026-12-01",
      todayYmd: TODAY,
    });
    expect(result).toMatchObject({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-12-01",
    });
  });

  it("denies expired free legacy even with the plan still connected", async () => {
    const result = await evaluateMemberAccessForRecord(record(LEGACY_FREE), {
      loadPaidThroughYmd: async () => "2026-07-21",
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(false);
    expect(result.viewerAccessState).toBe("loggedInNoAccess");
  });

  it("grants access from a valid Watson date without the free legacy plan", async () => {
    const result = await evaluateMemberAccessForRecord(
      {
        id: "mem_migrated",
        auth: { email: "legacy@example.com" },
        planConnections: [],
      },
      {
        loadPaidThroughYmd: async () => "2026-10-07",
        todayYmd: TODAY,
      },
    );
    expect(result).toMatchObject({
      hasMemberAccess: true,
      viewerAccessState: "memberAccess",
      legacyPaidThroughYmd: "2026-10-07",
    });
  });

  it("denies expired Watson dates without the free legacy plan", async () => {
    const result = await evaluateMemberAccessForRecord(
      {
        id: "mem_expired",
        auth: { email: "legacy@example.com" },
        planConnections: [],
      },
      {
        loadPaidThroughYmd: async () => "2020-01-01",
        todayYmd: TODAY,
      },
    );
    expect(result.hasMemberAccess).toBe(false);
  });

  it("enforces a saved complimentary date before any cleanup", async () => {
    const loadComplimentary = vi.fn(async () => "2026-07-21");
    const loadLegacy = vi.fn(async () => null);
    const expired = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: loadComplimentary,
      loadPaidThroughYmd: loadLegacy,
      todayYmd: TODAY,
    });
    expect(expired.hasMemberAccess).toBe(false);
    expect(expired.complimentaryThroughYmd).toBe("2026-07-21");
    expect(loadLegacy).toHaveBeenCalled();

    const stillLegacy = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: async () => "2026-07-21",
      loadPaidThroughYmd: async () => "2026-12-01",
      todayYmd: TODAY,
    });
    expect(stillLegacy.hasMemberAccess).toBe(true);

    const finalDay = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: async () => TODAY,
      loadPaidThroughYmd: async () => null,
      todayYmd: TODAY,
    });
    expect(finalDay.hasMemberAccess).toBe(true);

    const future = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: async () => "2027-01-04",
      loadPaidThroughYmd: async () => null,
      todayYmd: TODAY,
    });
    expect(future.hasMemberAccess).toBe(true);
    expect(future.complimentaryThroughYmd).toBe("2027-01-04");
  });

  it("keeps complimentary access when no date is saved and does not require legacy", async () => {
    const loadLegacy = vi.fn(async () => "2020-01-01");
    const result = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: async () => null,
      loadPaidThroughYmd: loadLegacy,
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(true);
    expect(result.complimentaryThroughYmd).toBeNull();
    expect(loadLegacy).not.toHaveBeenCalled();
  });

  it("denies expired complimentary access when legacy is also expired", async () => {
    const result = await evaluateMemberAccessForRecord(record(COMPLIMENTARY), {
      loadComplimentaryThroughYmd: async () => "2026-07-21",
      loadPaidThroughYmd: async () => "2020-01-01",
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(false);
  });

  it("fails closed when Watson lookup throws", async () => {
    const result = await evaluateMemberAccessForRecord(record(LEGACY_FREE), {
      loadPaidThroughYmd: async () => {
        throw new Error("db down");
      },
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(false);
    expect(result.legacyPaidThroughYmd).toBe(null);
    expect(result.legacyPaidThroughLookup).toBe("not_loaded");
    expect(result.legacyLookupFailed).toBe(true);
    expect(result.serverConfirmedPaidAccess).toBe(false);
  });

  it("does not flag a successful lookup that finds no record", async () => {
    const result = await evaluateMemberAccessForRecord(record(LEGACY_FREE), {
      loadPaidThroughYmd: async () => null,
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(false);
    expect(result.legacyPaidThroughLookup).toBe("not_found");
    expect(result.legacyLookupFailed).toBe(false);
  });

  it("fails closed on Watson lookup failure even without the free legacy plan", async () => {
    const result = await evaluateMemberAccessForRecord(
      {
        id: "mem_migrated",
        auth: { email: "legacy@example.com" },
        planConnections: [],
      },
      {
        loadPaidThroughYmd: async () => {
          throw new Error("db down");
        },
        todayYmd: TODAY,
      },
    );
    expect(result.hasMemberAccess).toBe(false);
    expect(result.legacyPaidThroughYmd).toBe(null);
  });
});
