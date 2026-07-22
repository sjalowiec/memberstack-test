import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { loadMembershipStatusForMemberId } from "./membershipStatusService";

describe("loadMembershipStatusForMemberId", () => {
  it("loads live Memberstack member by verified id and unique legacy history", async () => {
    const getMember = vi.fn(async (id: string) => {
      expect(id).toBe("mem_verified");
      return {
        id: "mem_verified",
        auth: { email: "unique@example.com" },
        planConnections: [],
        createdAt: "2024-01-01T00:00:00.000Z",
      };
    });

    const summary = await loadMembershipStatusForMemberId("mem_verified", {
      // July 22, 2026 afternoon Pacific — future legacy paid-through must not recommend purchase.
      now: new Date("2026-07-22T20:00:00.000Z"),
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember,
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: {
          memberid: "L1",
          fristname: "Ann",
          lastname: "Lee",
          email: "unique@example.com",
          address: null,
          address2: null,
          city: null,
          state: null,
          postalcode: null,
          country: null,
          birthdayinfo: null,
          datejoined: null,
          active: 1,
          betaactive: 0,
          currentsubscriber: 0,
        },
      }),
      loadMemberships: async (memberid) => {
        expect(memberid).toBe("L1");
        return [
          {
            subscriptionId: "10",
            subscriptionRateId: null,
            startDate: "Jan 1, 2025",
            startDateSort: "2025-01-01T00:00:00.000Z",
            expirationDate: "Jul 30, 2026",
            expirationDateSort: "2026-07-30T00:00:00.000Z",
            cancelDate: null,
            cancelDateSort: "",
            cancelledFlag: null,
            amount: null,
            amountSort: "",
            renewalFlag: null,
            monthlyBillingFlag: "0",
            premiumFlag: "1",
            processor: null,
            transactionGuid: null,
            arbId: null,
            invoiceNumber: null,
          },
        ];
      },
    });

    expect(getMember).toHaveBeenCalledWith("mem_verified");
    expect(summary.identified).toBe(true);
    expect(summary.legacyLinkState).toBe("linked");
    expect(summary.legacyExpirationDate).toBe("July 30, 2026");
    expect(summary.previousPlanName).toBe("Premium");
    expect(summary.recommendedAction).toBe("contact_support");
    expect(summary.customerFacingMessage).toMatch(/paid through July 30, 2026/i);
    expect(summary.customerFacingMessage).not.toMatch(/previous/i);
  });

  it("does not auto-link ambiguous legacy emails", async () => {
    const summary = await loadMembershipStatusForMemberId("mem_ambig", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async () => ({
            id: "mem_ambig",
            auth: { email: "shared@example.com" },
            planConnections: [],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({
        status: "ambiguous",
        members: [
          {
            memberid: "A",
            fristname: null,
            lastname: null,
            email: "shared@example.com",
            address: "1 Main",
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: 1,
            betaactive: 0,
            currentsubscriber: 0,
          },
          {
            memberid: "B",
            fristname: null,
            lastname: null,
            email: "shared@example.com",
            address: "2 Main",
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: 1,
            betaactive: 0,
            currentsubscriber: 0,
          },
        ],
      }),
      loadMemberships: async () => {
        throw new Error("should not load memberships for ambiguous email");
      },
    });

    expect(summary.legacyLinkState).toBe("ambiguous");
    expect(summary.legacyExpirationDate).toBeNull();
    expect(summary.previousPlanName).toBeNull();
    expect(summary.recommendedAction).toBe("contact_support");
    expect(JSON.stringify(summary)).not.toContain("1 Main");
    expect(JSON.stringify(summary)).not.toContain('"A"');
  });

  it("returns lookup unavailable when Memberstack getMember fails", async () => {
    const summary = await loadMembershipStatusForMemberId("mem_missing", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async () => {
            throw new Error("network");
          },
          listMembers: async () => ({ data: [] }),
        }) as never,
    });
    expect(summary.identified).toBe(false);
    expect(summary.currentStatus).toBe("unknown");
    expect(summary.recommendedAction).toBe("wait");
  });

  it("keeps active paid members on manage even with legacy history", async () => {
    const summary = await loadMembershipStatusForMemberId("mem_paid", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async () => ({
            id: "mem_paid",
            auth: { email: "paid@example.com" },
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({ status: "none" }),
    });
    expect(summary.currentStatus).toBe("active");
    expect(summary.recommendedAction).toBe("manage");
  });
});
