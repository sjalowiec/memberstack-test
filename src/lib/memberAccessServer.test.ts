import { describe, expect, it, vi } from "vitest";
import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../config/memberships";
import { evaluateMemberAccessForRecord, loadLegacyPaidThroughYmdForEmail } from "./memberAccessServer";

vi.mock("./watson/customerIdentifier", () => ({
  resolveLegacyLinkByMemberstackEmail: vi.fn(),
}));

import { resolveLegacyLinkByMemberstackEmail } from "./watson/customerIdentifier";

const LEGACY_FREE = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;
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
  it("grants paid membership without Watson", async () => {
    const load = vi.fn(async () => "2020-01-01");
    const result = await evaluateMemberAccessForRecord(record(PAID), {
      loadPaidThroughYmd: load,
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(true);
    expect(load).not.toHaveBeenCalled();
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

  it("fails closed when Watson lookup throws", async () => {
    const result = await evaluateMemberAccessForRecord(record(LEGACY_FREE), {
      loadPaidThroughYmd: async () => {
        throw new Error("db down");
      },
      todayYmd: TODAY,
    });
    expect(result.hasMemberAccess).toBe(false);
    expect(result.legacyPaidThroughYmd).toBe(null);
  });
});
