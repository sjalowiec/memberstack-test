import { describe, expect, it } from "vitest";

import {
  buildCustomerMemberstackSummary,
  buildCustomerPlanConnectionDisplay,
  formatMemberstackDisplayName,
  loadCustomerMemberstackMember,
  MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
  resolveMemberstackMemberByExactEmail,
} from "./customerMemberstack";
import { type MemberstackMember } from "../membership/membershipSummary";

describe("customerMemberstack", () => {
  it("builds plan connection display from Memberstack API fields", () => {
    const display = buildCustomerPlanConnectionDisplay({
      id: "pc_1",
      planId: "pln_kin-membership-annual-basic-je3s0vpe",
      planName: "Basic Annual",
      status: "ACTIVE",
      active: true,
      createdAt: "2026-01-15T00:00:00.000Z",
      payment: { priceId: "prc_basic-monthly-membership-s71690r6w" },
    });

    expect(display.activeLabel).toBe("Active");
    expect(display.billingInterval).toBe("monthly");
    expect(display.startDateSort).toBe("2026-01-15T00:00:00.000Z");
    expect(display.isPaidPlan).toBe(true);
  });

  it("marks unavailable state when Memberstack is not configured", () => {
    const summary = buildCustomerMemberstackSummary({
      member: null,
      configured: false,
      loadError: "Memberstack admin API is not configured.",
    });

    expect(summary.configured).toBe(false);
    expect(summary.loadError).toContain("not configured");
    expect(summary.connections).toEqual([]);
  });

  it("labels membership Active when any plan connection is active", () => {
    const summary = buildCustomerMemberstackSummary({
      member: {
        id: "mem_active",
        auth: { email: "active@example.com" },
        planConnections: [{ id: "pc_1", status: "ACTIVE", active: true }],
      },
      configured: true,
      loadError: null,
    });

    expect(summary.hasActiveConnection).toBe(true);
    expect(summary.membershipStatusLabel).toBe("Active");
  });

  it("labels membership No Plan when the Memberstack account has zero plan connections", () => {
    const summary = buildCustomerMemberstackSummary({
      member: {
        id: "mem_no_plan",
        auth: { email: "noplan@example.com" },
        planConnections: [],
      },
      configured: true,
      loadError: null,
    });

    expect(summary.hasActiveConnection).toBe(false);
    expect(summary.connections).toEqual([]);
    expect(summary.membershipStatusLabel).toBe("No Plan");
  });

  it("labels membership Inactive when plan connections exist but none are active", () => {
    const summary = buildCustomerMemberstackSummary({
      member: {
        id: "mem_inactive",
        auth: { email: "inactive@example.com" },
        planConnections: [{ id: "pc_1", status: "CANCELED", active: false }],
      },
      configured: true,
      loadError: null,
    });

    expect(summary.hasActiveConnection).toBe(false);
    expect(summary.connections).toHaveLength(1);
    expect(summary.membershipStatusLabel).toBe("Inactive");
  });

  it("uses Memberstack email when no name fields are available", () => {
    const member: MemberstackMember = {
      id: "mem_only",
      auth: { email: "only@example.com" },
      planConnections: [],
    };

    expect(formatMemberstackDisplayName(member)).toBe("only@example.com");
  });

  it("returns load_error when the Memberstack secret/client is missing", async () => {
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      secretKey: null,
      getClient: async () => null,
    });

    expect(result).toEqual({
      ok: false,
      status: "load_error",
      error: "Memberstack admin API is not configured.",
    });
  });

  it("returns load_error when the Admin API throws", async () => {
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      getClient: async () => ({
        getMember: async () => {
          throw new Error("network down");
        },
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result).toEqual({
      ok: false,
      status: "load_error",
      error: "Failed to load Memberstack member data.",
    });
  });

  it("returns load_error for a malformed Memberstack response", async () => {
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      getClient: async () => ({
        getMember: async () => ({ auth: { email: "thesmith@charter.net" } }),
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.status).toBe("load_error");
    expect(result.error).toContain("malformed");
  });

  it("returns not_found for a confirmed empty Admin API response", async () => {
    const result = await loadCustomerMemberstackMember({
      lookupValue: "missing@example.com",
      getClient: async () => ({
        getMember: async () => null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result).toEqual({
      ok: false,
      status: "not_found",
      error: "No Memberstack member found for this identifier.",
    });
  });

  it("returns linked for a successful Admin API lookup", async () => {
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      getClient: async () => ({
        getMember: async (lookup) =>
          lookup === "thesmith@charter.net"
            ? {
                id: "mem_cmohorhxj058z0ssd5yc6gcct",
                auth: { email: "thesmith@charter.net" },
                planConnections: [],
              }
            : null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.status).toBe("linked");
    expect(result.member.id).toBe("mem_cmohorhxj058z0ssd5yc6gcct");
  });

  it("normalizes mixed-case email before Memberstack lookup and links on success", async () => {
    const lookups: string[] = [];
    const result = await resolveMemberstackMemberByExactEmail("Thesmith@charter.net", {
      getClient: async () => ({
        getMember: async (lookup) => {
          lookups.push(lookup);
          return lookup === "thesmith@charter.net"
            ? {
                id: "mem_cmohorhxj058z0ssd5yc6gcct",
                auth: { email: "thesmith@charter.net" },
                planConnections: [],
              }
            : null;
        },
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(lookups).toEqual(["thesmith@charter.net"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.status).toBe("linked");
    expect(result.member.id).toBe("mem_cmohorhxj058z0ssd5yc6gcct");
  });

  it("maps confirmed email not-found to the email-specific label", async () => {
    const result = await resolveMemberstackMemberByExactEmail("missing@example.com", {
      getClient: async () => ({
        getMember: async () => null,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result).toEqual({
      ok: false,
      status: "not_found",
      error: MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
    });
  });
});
