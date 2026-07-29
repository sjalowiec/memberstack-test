import { describe, expect, it } from "vitest";
import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import type { LegacyMemberDetailRow } from "../watson/memberDetail";
import type { MemberMembershipDisplay } from "../watson/memberMembership";
import { loadAccountMembershipDetail } from "./accountMembershipDetail";

function legacyMember(
  overrides: Partial<LegacyMemberDetailRow> & { memberid: string; email: string },
): LegacyMemberDetailRow {
  return {
    fristname: null,
    lastname: null,
    address: null,
    address2: null,
    city: null,
    state: null,
    postalcode: null,
    country: null,
    birthdayinfo: null,
    datejoined: null,
    subscriptionexpiring: null,
    active: 1,
    betaactive: 0,
    currentsubscriber: 0,
    ...overrides,
  };
}

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

describe("loadAccountMembershipDetail", () => {
  it("returns an unidentified detail when the id is empty", async () => {
    const detail = await loadAccountMembershipDetail("  ");
    expect(detail.identified).toBe(false);
    expect(detail.history).toEqual([]);
  });

  it("summarizes an active monthly member with member-since and history", async () => {
    const detail = await loadAccountMembershipDetail("mem_active", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "active@example.com" },
            createdAt: "2017-03-14T00:00:00.000Z",
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
                createdAt: "2017-03-14T00:00:00.000Z",
                payment: {
                  priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
                  nextBillingDate: Math.floor(Date.UTC(2026, 7, 28, 12) / 1000),
                },
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({ status: "none" }),
    });

    expect(detail.identified).toBe(true);
    expect(detail.membershipName).toBe(MEMBERSHIPS.membership.name);
    expect(detail.statusLabel).toBe("Active");
    expect(detail.billingLabel).toBe("Monthly");
    expect(detail.nextRenewalDate).toBe("August 28, 2026");
    expect(detail.activeThroughDate).toBeNull();
    expect(detail.legacyPaidThroughDate).toBeNull();
    expect(detail.memberSince).toBe("March 14, 2017");
    expect(detail.history.map((event) => event.title)).toContain("Monthly Membership Started");
  });

  it("shows active-through for a canceling member and hides next renewal", async () => {
    const cancelAt = Math.floor(Date.UTC(2026, 8, 28, 12) / 1000);
    const detail = await loadAccountMembershipDetail("mem_cancel", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "cancel@example.com" },
            createdAt: "2020-01-01T00:00:00.000Z",
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
                createdAt: "2020-01-01T00:00:00.000Z",
                payment: {
                  priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
                  cancelAtDate: cancelAt,
                },
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({ status: "none" }),
    });

    expect(detail.statusLabel).toBe("Canceling");
    expect(detail.activeThroughDate).toBe("September 28, 2026");
    expect(detail.nextRenewalDate).toBeNull();
    expect(detail.billingLabel).toBe("Annual");
  });

  it("presents a legacy free-access member with legacy paid-through and member-since", async () => {
    const detail = await loadAccountMembershipDetail("mem_legacy", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T20:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "legacy@example.com" },
            createdAt: "2026-07-30T00:00:00.000Z",
            planConnections: [
              {
                planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
                planName: FREE_ACCESS_MEMBERSHIPS.legacyMembership.name,
                status: "ACTIVE",
                active: true,
                createdAt: "2026-07-30T00:00:00.000Z",
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "L1",
          email: "legacy@example.com",
          datejoined: "2012-01-05T00:00:00.000Z",
        }),
      }),
      loadMemberships: async (memberid) => {
        expect(memberid).toBe("L1");
        return [
          legacyRow({
            startDateSort: "2012-01-05T00:00:00.000Z",
            expirationDate: "Dec 31, 2026",
            expirationDateSort: "2026-12-31T00:00:00.000Z",
            premiumFlag: "1",
          }),
        ];
      },
    });

    expect(detail.identified).toBe(true);
    expect(detail.statusLabel).toBe("Legacy Access");
    expect(detail.memberSince).toBe("January 5, 2012");
    expect(detail.legacyPaidThroughDate).toBe("December 31, 2026");
    const titles = detail.history.map((event) => event.title);
    expect(titles[0]).toBe("Joined Knit it Now");
    expect(titles).toContain("Migrated to the new Knit it Now");
  });

  it("shows Legacy Access for future legacy paid-through with no active Memberstack plan", async () => {
    const detail = await loadAccountMembershipDetail("mem_future_legacy", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T19:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "future@example.com" },
            createdAt: "2026-04-08T00:00:00.000Z",
            planConnections: [],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "L-FUTURE",
          email: "future@example.com",
          datejoined: "2021-10-19T00:00:00.000Z",
        }),
      }),
      loadMemberships: async () => [
        legacyRow({
          startDateSort: "2021-11-02T00:00:00.000Z",
          expirationDate: "Dec 1, 2029",
          expirationDateSort: "2029-12-01T12:00:00.000Z",
        }),
      ],
    });

    expect(detail.membershipName).toBeNull();
    expect(detail.statusLabel).toBe("Legacy Access");
    expect(detail.legacyPaidThroughDate).toBe("December 1, 2029");
    expect(detail.legacyAccessActive).toBe(true);
  });

  it("treats legacy access expiring today as still active", async () => {
    const detail = await loadAccountMembershipDetail("mem_today_legacy", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T19:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "today@example.com" },
            createdAt: "2026-04-08T00:00:00.000Z",
            planConnections: [],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "L-TODAY",
          email: "today@example.com",
          datejoined: "2020-01-01T00:00:00.000Z",
        }),
      }),
      loadMemberships: async () => [
        legacyRow({
          startDateSort: "2020-01-01T00:00:00.000Z",
          expirationDate: "Jul 28, 2026",
          expirationDateSort: "2026-07-28T12:00:00.000Z",
        }),
      ],
    });

    expect(detail.statusLabel).toBe("Legacy Access");
    expect(detail.legacyPaidThroughDate).toBe("July 28, 2026");
    expect(detail.legacyAccessActive).toBe(true);
  });

  it("shows Expired with an ended legacy access date for past legacy paid-through", async () => {
    const detail = await loadAccountMembershipDetail("mem_expired_legacy", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T19:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "expired@example.com" },
            createdAt: "2026-05-13T00:00:00.000Z",
            planConnections: [],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "L-EXPIRED",
          email: "expired@example.com",
          datejoined: "2023-10-27T00:00:00.000Z",
        }),
      }),
      loadMemberships: async () => [
        legacyRow({
          startDateSort: "2026-03-05T00:00:00.000Z",
          expirationDate: "Apr 6, 2026",
          expirationDateSort: "2026-04-06T12:00:00.000Z",
        }),
      ],
    });

    expect(detail.membershipName).toBeNull();
    expect(detail.statusLabel).toBe("Expired");
    expect(detail.legacyPaidThroughDate).toBe("April 6, 2026");
    expect(detail.legacyAccessActive).toBe(false);
  });

  it("keeps the active paid status and hides legacy paid-through for a paid member with legacy history", async () => {
    const detail = await loadAccountMembershipDetail("mem_paid_legacy", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T19:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "paidlegacy@example.com" },
            createdAt: "2026-07-16T00:00:00.000Z",
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
                createdAt: "2026-07-16T00:00:00.000Z",
                payment: {
                  priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
                  nextBillingDate: Math.floor(Date.UTC(2026, 7, 16, 12) / 1000),
                },
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "L-PAID",
          email: "paidlegacy@example.com",
          datejoined: "2023-10-18T00:00:00.000Z",
        }),
      }),
      loadMemberships: async () => [
        legacyRow({
          startDateSort: "2023-10-18T00:00:00.000Z",
          expirationDate: "Nov 1, 2024",
          expirationDateSort: "2024-11-01T12:00:00.000Z",
        }),
      ],
    });

    expect(detail.membershipName).toBe(MEMBERSHIPS.membership.name);
    expect(detail.statusLabel).toBe("Active");
    expect(detail.legacyPaidThroughDate).toBeNull();
    expect(detail.legacyAccessActive).toBeNull();
    expect(detail.history.map((event) => event.title)).toContain("Joined Knit it Now");
  });

  it("stays in the no-active-membership state with no membership and no legacy history", async () => {
    const detail = await loadAccountMembershipDetail("mem_none", {
      secretKey: "sk_test",
      now: new Date("2026-07-28T19:00:00.000Z"),
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "none@example.com" },
            createdAt: "2026-06-01T00:00:00.000Z",
            planConnections: [],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({ status: "none" }),
    });

    expect(detail.identified).toBe(true);
    expect(detail.membershipName).toBeNull();
    expect(detail.statusLabel).toBeNull();
    expect(detail.legacyPaidThroughDate).toBeNull();
    expect(detail.legacyAccessActive).toBeNull();
  });

  it("never leaks identifiers in the serialized detail", async () => {
    const detail = await loadAccountMembershipDetail("mem_secret", {
      secretKey: "sk_super_secret",
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "secret@example.com" },
            createdAt: "2021-05-05T00:00:00.000Z",
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
                createdAt: "2021-05-05T00:00:00.000Z",
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: legacyMember({
          memberid: "LEGACY-9999",
          email: "secret@example.com",
          datejoined: "2010-02-02T00:00:00.000Z",
        }),
      }),
      loadMemberships: async () => [
        legacyRow({
          startDateSort: "2010-02-02T00:00:00.000Z",
          transactionGuid: "guid-secret",
          arbId: "arb-secret",
        }),
      ],
    });

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("sk_super_secret");
    expect(serialized).not.toContain("LEGACY-9999");
    expect(serialized).not.toContain("guid-secret");
    expect(serialized).not.toContain("arb-secret");
    expect(serialized).not.toContain(MEMBERSHIPS.membership.memberstackPlanId);
  });
});
