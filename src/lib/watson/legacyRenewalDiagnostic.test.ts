import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  COMPLIMENTARY_MEMBERSHIPS,
  FREE_ACCESS_MEMBERSHIPS,
  MEMBERSHIPS,
} from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  buildWatsonPaidThroughIndex,
  legacyRenewalLiveEnabled,
  listMemberstackMembersForDiagnostic,
  renewalTagNamesInDeployedCode,
  summarizeLegacyMembershipSegment,
  type WatsonPaidThroughRow,
} from "./legacyRenewalDiagnostic";

const LEGACY = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const COMP = COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;

function member(
  id: string,
  email: string | null,
  plans: Array<{ planId: string; status?: string }>,
): MemberstackMember {
  return {
    id,
    auth: email ? { email } : undefined,
    planConnections: plans.map((plan) => ({
      planId: plan.planId,
      status: plan.status ?? "ACTIVE",
      active: plan.status !== "CANCELED",
    })),
  };
}

function index(rows: WatsonPaidThroughRow[]) {
  return buildWatsonPaidThroughIndex(rows);
}

describe("legacy renewal diagnostic", () => {
  it("classifies dates and overlapping paid or complimentary access", () => {
    const summary = summarizeLegacyMembershipSegment({
      todayYmd: "2026-10-04",
      members: [
        member("mem_future", "future@example.com", [{ planId: LEGACY }]),
        member("mem_today", "today@example.com", [{ planId: LEGACY }]),
        member("mem_expired", "expired@example.com", [{ planId: LEGACY }]),
        member("mem_blank", "blank@example.com", [{ planId: LEGACY }]),
        member("mem_missing", "missing@example.com", [{ planId: LEGACY }]),
        member("mem_ambiguous", "two@example.com", [{ planId: LEGACY }]),
        member("mem_paid", "paid@example.com", [{ planId: LEGACY }, { planId: PAID }]),
        member("mem_comp", "comp@example.com", [{ planId: LEGACY }, { planId: COMP }]),
        member("mem_comp_open", "open@example.com", [{ planId: LEGACY }, { planId: COMP }]),
        member("mem_canceled", "old@example.com", [{ planId: LEGACY, status: "CANCELED" }]),
      ],
      watsonByEmail: index([
        { memberid: "w1", email: "future@example.com", paid_through_ymd: "2026-12-01" },
        { memberid: "w2", email: "today@example.com", paid_through_ymd: "2026-10-04" },
        { memberid: "w3", email: "expired@example.com", paid_through_ymd: "2026-09-01" },
        { memberid: "w4", email: "blank@example.com", paid_through_ymd: null },
        { memberid: "w5a", email: "two@example.com", paid_through_ymd: "2026-11-01" },
        { memberid: "w5b", email: "two@example.com", paid_through_ymd: "2026-11-02" },
        { memberid: "w6", email: "paid@example.com", paid_through_ymd: "2026-11-15" },
        { memberid: "w7", email: "comp@example.com", paid_through_ymd: "2026-10-01" },
        { memberid: "w8", email: "open@example.com", paid_through_ymd: "2026-10-20" },
      ]),
      complimentaryByMemberstackId: new Map([["mem_comp", "2026-12-25"]]),
    });

    expect(summary.activeLegacyMembership).toBe(9);
    expect(summary.inactiveLegacyConnectionOnly).toBe(1);
    expect(summary.dates).toEqual({
      future: 3,
      today: 1,
      expired: 2,
      missing: 2,
      ambiguous: 1,
    });
    expect(summary.missingBreakdown).toEqual({ unmatched: 1, noDate: 1 });
    expect(summary.activePaidMembership).toBe(1);
    expect(summary.complimentaryExtendsBeyondLegacyDate).toBe(2);
  });

  it("pages until Memberstack reports no next page", async () => {
    const pages = [
      { data: [{ id: "mem_1" }], hasNextPage: true, endCursor: 1, totalCount: 2 },
      { data: [{ id: "mem_2" }], hasNextPage: false, endCursor: 2, totalCount: 2 },
    ];
    const listed = await listMemberstackMembersForDiagnostic({
      listMembers: async () => pages.shift()!,
    });
    expect(listed.pages).toBe(2);
    expect(listed.truncated).toBe(false);
    expect(listed.members).toHaveLength(2);
    expect(listed.reportedTotalCount).toBe(2);
  });

  it("treats only the exact string true as live", () => {
    expect(legacyRenewalLiveEnabled({ LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: "true" })).toBe(true);
    expect(legacyRenewalLiveEnabled({ LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: "false" })).toBe(
      false,
    );
    expect(legacyRenewalLiveEnabled({})).toBe(false);
  });

  it("returns the singular tag names the reminder job writes", () => {
    expect(renewalTagNamesInDeployedCode()).toEqual([
      "legacy-renewal-30-day",
      "legacy-renewal-7-day",
      "legacy-renewal-1-day",
    ]);
  });

  it("exposes a Watson-admin GET that does not write", () => {
    const route = fs.readFileSync(
      path.resolve("src/pages/api/watson/legacy-renewal-diagnostic.ts"),
      "utf8",
    );
    expect(route).toContain("export const GET");
    expect(route).not.toContain("export const POST");
    expect(route).toContain("requireWatsonAdminJson");
    expect(route).not.toMatch(/syncContact|addTag|removePlan|contact\/sync/);
  });
});
