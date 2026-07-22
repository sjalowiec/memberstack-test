import { describe, expect, it } from "vitest";

import { MEMBERSHIPS, REMOVED_BASIC_MEMBERSHIP_PLAN_ID } from "../../config/memberships";
import {
  computeMembershipSummary,
  connectionCanceledAt,
  fetchAllMembers,
  isCanceledConnectionStatus,
  monthlyEquivalent,
  paidConnectionPriceId,
} from "./membershipSummary";

const NOW = new Date("2026-07-12T15:30:00.000Z");
const MEMBERSHIP_PLAN_ID = MEMBERSHIPS.membership.memberstackPlanId;
const MEMBERSHIP_MONTHLY_PRICE_ID = MEMBERSHIPS.membership.prices.monthly.memberstackPriceId;
const MEMBERSHIP_ANNUAL_PRICE_ID = MEMBERSHIPS.membership.prices.annual.memberstackPriceId;

describe("membershipSummary", () => {
  it("counts active members, new members, and revenue from Memberstack-shaped fixtures", () => {
    const summary = computeMembershipSummary(
      [
        {
          id: "mem_active",
          createdAt: "2026-07-10T00:00:00.000Z",
          planConnections: [
            {
              planId: MEMBERSHIP_PLAN_ID,
              active: true,
              status: "ACTIVE",
              payment: { priceId: MEMBERSHIP_MONTHLY_PRICE_ID },
            },
          ],
        },
        {
          id: "mem_annual",
          createdAt: "2026-05-01T00:00:00.000Z",
          planConnections: [
            {
              planId: MEMBERSHIP_PLAN_ID,
              status: "ACTIVE",
              payment: { priceId: MEMBERSHIP_ANNUAL_PRICE_ID },
            },
          ],
        },
        {
          id: "mem_new_old",
          createdAt: "2026-06-15T00:00:00.000Z",
          planConnections: [],
        },
      ],
      { now: NOW },
    );

    expect(summary.activeMembersTotal).toBe(2);
    expect(summary.newMembers.thisMonth).toBe(1);
    expect(summary.revenue.mrrEstimate).toBeCloseTo(19.99 + 228 / 12, 2);
    expect(summary.revenue.arrEstimate).toBeCloseTo(summary.revenue.mrrEstimate * 12, 2);
    expect(summary.activeByPlan).toEqual([
      { planKey: "membership", planName: MEMBERSHIPS.membership.name, activeMembers: 2 },
    ]);
  });

  it("tracks canceled connections overall and within the current month", () => {
    const summary = computeMembershipSummary(
      [
        {
          id: "mem_cancelled",
          planConnections: [
            {
              planId: MEMBERSHIP_PLAN_ID,
              status: "CANCELED",
              canceledAt: "2026-07-05T00:00:00.000Z",
            },
            {
              planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
              status: "EXPIRED",
              cancelledAt: "2026-05-01T00:00:00.000Z",
            },
          ],
        },
      ],
      { now: NOW },
    );

    expect(summary.canceledConnectionsTotal).toBe(2);
    expect(summary.canceledConnectionsThisMonth).toBe(1);
  });

  it("excludes unresolved paid connections from MRR and surfaces a note", () => {
    const summary = computeMembershipSummary(
      [
        {
          id: "mem_unresolved",
          planConnections: [
            {
              planId: MEMBERSHIP_PLAN_ID,
              active: true,
              status: "ACTIVE",
              payment: { priceId: "prc_unknown" },
            },
          ],
        },
      ],
      { now: NOW },
    );

    expect(summary.activeMembersTotal).toBe(1);
    expect(summary.revenue.mrrEstimate).toBe(0);
    expect(summary.revenue.unresolvedPaidConnections).toBe(1);
    expect(summary.revenue.note).toContain("could not be matched");
  });

  it("paginates through Memberstack listMembers responses", async () => {
    const calls: Array<{ after?: number | string }> = [];
    const client = {
      listMembers: async ({ after }: { after?: number | string } = {}) => {
        calls.push({ after });
        if (!after) {
          return {
            data: [{ id: "mem_1" }],
            hasNextPage: true,
            endCursor: 100,
          };
        }
        return {
          data: [{ id: "mem_2" }],
          hasNextPage: false,
        };
      },
    };

    const result = await fetchAllMembers(client);
    expect(result.members.map((member) => member.id)).toEqual(["mem_1", "mem_2"]);
    expect(result.truncated).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("exposes helper semantics used by the shared summary", () => {
    expect(isCanceledConnectionStatus("cancelled")).toBe(true);
    expect(
      paidConnectionPriceId({
        payment: { priceId: MEMBERSHIP_MONTHLY_PRICE_ID },
      }),
    ).toBe(MEMBERSHIP_MONTHLY_PRICE_ID);
    expect(
      connectionCanceledAt({
        canceledAt: "2026-07-01T00:00:00.000Z",
      })?.toISOString(),
    ).toBe("2026-07-01T00:00:00.000Z");
    expect(
      monthlyEquivalent({
        planKey: "membership",
        interval: "annual",
        amount: 228,
      }),
    ).toBe(19);
  });
});
