import { describe, expect, it } from "vitest";
import { FREE_ACCESS_MEMBERSHIPS } from "../../config/memberships";
import type { CustomerPlanConnectionDisplay } from "../watson/customerMemberstack";
import type { MemberMembershipDisplay } from "../watson/memberMembership";
import {
  buildMembershipHistory,
  type MembershipHistoryEvent,
} from "./membershipHistory";

function legacyRow(
  overrides: Partial<MemberMembershipDisplay> & { startDateSort: string },
): MemberMembershipDisplay {
  return {
    subscriptionId: "s",
    subscriptionRateId: null,
    startDate: null,
    startDateSort: overrides.startDateSort,
    expirationDate: null,
    expirationDateSort: "",
    cancelDate: null,
    cancelDateSort: "",
    cancelledFlag: null,
    amount: null,
    amountSort: "",
    renewalFlag: null,
    monthlyBillingFlag: null,
    premiumFlag: null,
    processor: null,
    transactionGuid: null,
    arbId: null,
    invoiceNumber: null,
    ...overrides,
  };
}

function connection(
  overrides: Partial<CustomerPlanConnectionDisplay>,
): CustomerPlanConnectionDisplay {
  return {
    connectionId: null,
    planName: null,
    planId: null,
    status: null,
    activeLabel: "Active",
    billingInterval: null,
    startDate: null,
    startDateSort: "",
    canceledAt: null,
    canceledAtSort: "",
    isPaidPlan: null,
    ...overrides,
  };
}

function titles(events: MembershipHistoryEvent[]): string[] {
  return events.map((event) => event.title);
}

describe("buildMembershipHistory", () => {
  it("returns an empty timeline when there is nothing to show", () => {
    expect(buildMembershipHistory({})).toEqual([]);
  });

  it("emits a Joined milestone from the legacy join date", () => {
    const events = buildMembershipHistory({ legacyJoinedDate: "2017-03-14" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "joined",
      title: "Joined Knit it Now",
      date: "March 14, 2017",
      dateSort: "2017-03-14",
    });
  });

  it("assembles a chronological migration story oldest-first", () => {
    const events = buildMembershipHistory({
      legacyJoinedDate: "2017-03-14",
      legacyMemberships: [
        legacyRow({ startDateSort: "2025-01-01T00:00:00.000Z", renewalFlag: "1" }),
      ],
      memberstackAccountCreatedDate: "2026-07-30T12:00:00.000Z",
      hasLegacyHistory: true,
      connections: [
        connection({
          isPaidPlan: true,
          billingInterval: "monthly",
          startDateSort: "2026-08-01T00:00:00.000Z",
        }),
      ],
    });

    expect(titles(events)).toEqual([
      "Joined Knit it Now",
      "Renewed Annual Membership",
      "Migrated to the new Knit it Now",
      "Monthly Membership Started",
    ]);
    expect(events.map((event) => event.date)).toEqual([
      "March 14, 2017",
      "January 1, 2025",
      "July 30, 2026",
      "August 1, 2026",
    ]);
  });

  it("labels the first legacy annual subscription as a start, later ones as renewals", () => {
    const events = buildMembershipHistory({
      legacyJoinedDate: "2012-01-05",
      legacyMemberships: [
        legacyRow({ startDateSort: "2013-01-05T00:00:00.000Z" }),
        legacyRow({ startDateSort: "2012-01-05T00:00:00.000Z" }),
      ],
    });

    expect(titles(events)).toEqual([
      "Joined Knit it Now",
      "Annual Membership Started",
      "Renewed Annual Membership",
    ]);
  });

  it("does not duplicate a start when the join milestone came from that same legacy row", () => {
    const events = buildMembershipHistory({
      legacyMemberships: [
        legacyRow({ startDateSort: "2015-06-01T00:00:00.000Z" }),
        legacyRow({ startDateSort: "2016-06-01T00:00:00.000Z" }),
      ],
    });

    expect(titles(events)).toEqual([
      "Joined Knit it Now",
      "Renewed Annual Membership",
    ]);
  });

  it("emits a cancellation when a legacy subscription was canceled", () => {
    const events = buildMembershipHistory({
      legacyJoinedDate: "2018-02-02",
      legacyMemberships: [
        legacyRow({
          startDateSort: "2018-02-02T00:00:00.000Z",
          cancelledFlag: "1",
          cancelDateSort: "2019-03-03T00:00:00.000Z",
        }),
      ],
    });

    expect(titles(events)).toContain("Membership Canceled");
    const canceled = events.find((event) => event.type === "canceled");
    expect(canceled?.date).toBe("March 3, 2019");
  });

  it("treats a live legacy-membership free connection as a migration import", () => {
    const events = buildMembershipHistory({
      hasLegacyHistory: true,
      memberstackAccountCreatedDate: "2026-01-01",
      connections: [
        connection({
          planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
          isPaidPlan: false,
          startDateSort: "2026-07-30T00:00:00.000Z",
        }),
      ],
    });

    const migrated = events.find((event) => event.type === "migrated");
    expect(migrated).toBeTruthy();
    expect(migrated?.date).toBe("July 30, 2026");
    // Only one migration event even though account-created is also present.
    expect(events.filter((event) => event.type === "migrated")).toHaveLength(1);
  });

  it("marks a reactivation after a canceled paid connection", () => {
    const events = buildMembershipHistory({
      connections: [
        connection({
          isPaidPlan: true,
          billingInterval: "monthly",
          startDateSort: "2024-01-01T00:00:00.000Z",
          canceledAtSort: "2024-06-01T00:00:00.000Z",
        }),
        connection({
          isPaidPlan: true,
          billingInterval: "annual",
          startDateSort: "2025-01-01T00:00:00.000Z",
        }),
      ],
    });

    expect(titles(events)).toEqual([
      "Joined Knit it Now",
      "Monthly Membership Started",
      "Membership Canceled",
      "Membership Reactivated",
    ]);
  });

  it("falls back to the account-created date for a paid connection missing its start date", () => {
    const events = buildMembershipHistory({
      memberstackAccountCreatedDate: "2026-07-16T12:00:00.000Z",
      connections: [
        connection({
          isPaidPlan: true,
          billingInterval: "monthly",
          startDateSort: "",
        }),
      ],
    });

    const started = events.find((event) => event.type === "monthly_started");
    expect(started).toBeTruthy();
    expect(started?.title).toBe("Monthly Membership Started");
    expect(started?.date).toBe("July 16, 2026");
  });

  it("omits the Started milestone when neither a connection start nor account-created date exists", () => {
    const events = buildMembershipHistory({
      connections: [connection({ isPaidPlan: true, billingInterval: "monthly", startDateSort: "" })],
    });

    expect(events.some((event) => event.type.endsWith("started"))).toBe(false);
  });

  it("never leaks identifiers, amounts, or technical fields", () => {
    const events = buildMembershipHistory({
      legacyJoinedDate: "2017-03-14",
      legacyMemberships: [
        legacyRow({
          startDateSort: "2025-01-01T00:00:00.000Z",
          amount: "$228.00",
          transactionGuid: "guid-should-not-appear",
          arbId: "arb-123",
          invoiceNumber: "inv-999",
          processor: "authorize.net",
        }),
      ],
      connections: [
        connection({
          isPaidPlan: true,
          planId: "pln_secret_id",
          connectionId: "cus_secret",
          startDateSort: "2026-08-01T00:00:00.000Z",
          billingInterval: "monthly",
        }),
      ],
    });

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("guid-should-not-appear");
    expect(serialized).not.toContain("arb-123");
    expect(serialized).not.toContain("inv-999");
    expect(serialized).not.toContain("authorize.net");
    expect(serialized).not.toContain("pln_secret_id");
    expect(serialized).not.toContain("cus_secret");
    expect(serialized).not.toContain("228");
  });
});
