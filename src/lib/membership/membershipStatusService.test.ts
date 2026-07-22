import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { resolveCustomerMemberstackSecretKey } from "../watson/customerMemberstack";
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
      // July 22, 2026 afternoon Pacific  future legacy paid-through must not recommend purchase.
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
    expect(summary.customerFacingMessage).toMatch(
      /Good news! It looks like your Premium annual membership still has paid time remaining through July 30, 2026/,
    );
    expect(summary.customerFacingMessage).not.toMatch(/previous/i);
    expect(summary.customerFacingMessage).not.toMatch(/active membership on your new account/i);
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

  it("returns calm unknown/wait publicly when Admin getMember fails, with distinguishable logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    expect(warn).toHaveBeenCalledWith(
      "[membership-status] Memberstack Admin lookup unsuccessful",
      expect.objectContaining({
        failureReason: "admin_lookup_failed",
        operation: "getMember by id",
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sk_test");
    warn.mockRestore();
  });

  it("distinguishes member_not_found internally while keeping calm public wait", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const summary = await loadMembershipStatusForMemberId("mem_gone", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async () => null,
          listMembers: async () => ({ data: [] }),
        }) as never,
    });
    expect(summary.currentStatus).toBe("unknown");
    expect(summary.recommendedAction).toBe("wait");
    expect(warn).toHaveBeenCalledWith(
      "[membership-status] Memberstack Admin lookup unsuccessful",
      expect.objectContaining({ failureReason: "member_not_found" }),
    );
    warn.mockRestore();
  });

  it("distinguishes admin_not_configured internally while keeping calm public wait", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const summary = await loadMembershipStatusForMemberId("mem_any", {
      secretKey: null,
    });
    expect(summary.currentStatus).toBe("unknown");
    expect(summary.recommendedAction).toBe("wait");
    expect(warn).toHaveBeenCalledWith(
      "[membership-status] Memberstack Admin lookup unsuccessful",
      expect.objectContaining({ failureReason: "admin_not_configured" }),
    );
    warn.mockRestore();
  });

  it("distinguishes environment_mismatch for mem_sb_ + live secret without leaking secrets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "sk_live_should_not_appear";
    const summary = await loadMembershipStatusForMemberId("mem_sb_testmember", {
      secretKey: secret,
      getClient: async () =>
        ({
          getMember: async () => ({
            id: "mem_sb_testmember",
            planConnections: [{ planId: "pln_x", status: "ACTIVE", active: true }],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
    });
    expect(summary.currentStatus).toBe("unknown");
    expect(summary.recommendedAction).toBe("wait");
    expect(warn).toHaveBeenCalledWith(
      "[membership-status] Memberstack Admin lookup unsuccessful",
      expect.objectContaining({ failureReason: "environment_mismatch" }),
    );
    expect(JSON.stringify(summary)).not.toContain(secret);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
    warn.mockRestore();
    error.mockRestore();
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

  it("returns canceling/manage for canceling active paid members", async () => {
    const cancelAt = Math.floor(Date.UTC(2026, 7, 18) / 1000);
    const summary = await loadMembershipStatusForMemberId("mem_canceling", {
      secretKey: "sk_test",
      getClient: async () =>
        ({
          getMember: async (id: string) => ({
            id,
            auth: { email: "canceling@example.com" },
            planConnections: [
              {
                planId: MEMBERSHIPS.membership.memberstackPlanId,
                planName: MEMBERSHIPS.membership.name,
                status: "ACTIVE",
                active: true,
                payment: { cancelAtDate: cancelAt },
              },
            ],
          }),
          listMembers: async () => ({ data: [] }),
        }) as never,
      resolveLegacyLink: async () => ({ status: "none" }),
    });
    expect(summary.currentStatus).toBe("canceling");
    expect(summary.recommendedAction).toBe("manage");
  });

  it("reaches Admin getMember when secret is resolved via shared helper (no import.meta.env)", async () => {
    const getMember = vi.fn(async (id: string) => ({
      id,
      auth: { email: "paid@example.com" },
      planConnections: [
        {
          planId: MEMBERSHIPS.membership.memberstackPlanId,
          planName: MEMBERSHIPS.membership.name,
          status: "ACTIVE",
          active: true,
        },
      ],
    }));

    // Same shape membership-status uses after JWT verify: id only, secret from shared resolver.
    const secretKey = resolveCustomerMemberstackSecretKey(undefined, {
      getSharedSecretKey: () => "sk_shared_status_path",
    });

    const summary = await loadMembershipStatusForMemberId("mem_paid", {
      secretKey,
      getClient: async (key) => {
        expect(key).toBe("sk_shared_status_path");
        return {
          getMember,
          listMembers: async () => ({ data: [] }),
        } as never;
      },
      resolveLegacyLink: async () => ({ status: "none" }),
    });

    expect(getMember).toHaveBeenCalledWith("mem_paid");
    expect(summary.currentStatus).toBe("active");
    expect(summary.recommendedAction).toBe("manage");
    expect(JSON.stringify(summary)).not.toContain("sk_shared_status_path");
  });
});
