import { describe, expect, it, vi } from "vitest";

import {
  buildCustomerMemberstackSummary,
  buildCustomerPlanConnectionDisplay,
  formatMemberstackDisplayName,
  loadCustomerMemberstackMember,
  MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
  resolveCustomerMemberstackSecretKey,
  resolveMemberstackMemberByExactEmail,
} from "./customerMemberstack";
import { type MemberstackMember } from "../membership/membershipSummary";

describe("resolveCustomerMemberstackSecretKey", () => {
  it("does not throw when import.meta.env-style env is unavailable", () => {
    expect(() =>
      resolveCustomerMemberstackSecretKey(undefined, {
        getSharedSecretKey: () => "sk_from_shared",
      }),
    ).not.toThrow();
    expect(
      resolveCustomerMemberstackSecretKey(undefined, {
        getSharedSecretKey: () => "sk_from_shared",
      }),
    ).toBe("sk_from_shared");
  });

  it("uses an explicitly supplied env object when provided", () => {
    expect(
      resolveCustomerMemberstackSecretKey(
        { MEMBERSTACK_SECRET_KEY: "  sk_explicit_env  " },
        { getSharedSecretKey: () => "sk_should_not_win" },
      ),
    ).toBe("sk_explicit_env");
  });

  it("returns null for missing/blank secrets without throwing", () => {
    expect(resolveCustomerMemberstackSecretKey({})).toBeNull();
    expect(
      resolveCustomerMemberstackSecretKey(undefined, {
        getSharedSecretKey: () => null,
      }),
    ).toBeNull();
    expect(
      resolveCustomerMemberstackSecretKey(undefined, {
        getSharedSecretKey: () => "   ",
      }),
    ).toBeNull();
  });

  it("reaches Admin getMember when secret comes from the shared resolver", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getMember = vi.fn(async (id: string) => ({
      id,
      auth: { email: "paid@example.com" },
      planConnections: [
        {
          id: "con_1",
          active: true,
          status: "ACTIVE",
          planId: "pln_monthly-subscription-to-knititnow-webx0nz5",
        },
      ],
    }));

    const secretKey = resolveCustomerMemberstackSecretKey(undefined, {
      getSharedSecretKey: () => "sk_shared_not_for_logs",
    });
    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_activepaid1",
      secretKey,
      getClient: async (key) => {
        expect(key).toBe("sk_shared_not_for_logs");
        return {
          getMember,
          listMembers: async () => ({ data: [], hasNextPage: false }),
        };
      },
    });

    expect(getMember).toHaveBeenCalledWith("mem_activepaid1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe("mem_activepaid1");
    }
    expect(JSON.stringify(result)).not.toContain("sk_shared_not_for_logs");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sk_shared_not_for_logs");
    warn.mockRestore();
  });
});

describe("customerMemberstack", () => {
  it("builds plan connection display from Memberstack API fields", () => {
    const display = buildCustomerPlanConnectionDisplay({
      id: "pc_1",
      planId: "pln_kin-membership-annual-premium-tn5b0cxj",
      planName: "Basic Annual",
      status: "ACTIVE",
      active: true,
      createdAt: "2026-01-15T00:00:00.000Z",
      payment: { priceId: "prc_monthly-subscription-to-knititnow-webw0nzy" },
    });

    expect(display.activeLabel).toBe("Active");
    expect(display.billingInterval).toBe("monthly");
    expect(display.startDateSort).toBe("2026-01-15T00:00:00.000Z");
    expect(display.isPaidPlan).toBe(true);
  });

  it("still builds Active summary/display for a successful Admin paid connection payload", () => {
    const member = {
      id: "mem_activepaid1",
      auth: { email: "paid@example.com" },
      planConnections: [
        {
          id: "con_1",
          active: true,
          status: "ACTIVE" as const,
          planId: "pln_monthly-subscription-to-knititnow-webx0nz5",
          planName: "Monthly Subscription to Knititnow",
          payment: { priceId: "prc_monthly-subscription-to-knititnow-webw0nzy" },
        },
      ],
    };
    const display = buildCustomerPlanConnectionDisplay(member.planConnections[0]);
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    expect(display.activeLabel).toBe("Active");
    expect(display.isPaidPlan).toBe(true);
    expect(summary.hasActiveConnection).toBe(true);
    expect(summary.membershipStatusLabel).toBe("Active");
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

  it("returns admin_not_configured when the Memberstack secret/client is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      secretKey: null,
    });

    expect(result).toEqual({
      ok: false,
      status: "load_error",
      failureReason: "admin_not_configured",
      error: "Memberstack admin API is not configured.",
    });
    expect(warn).toHaveBeenCalledWith(
      "[watson-memberstack] Admin client unavailable",
      expect.objectContaining({ failureReason: "admin_not_configured" }),
    );
    warn.mockRestore();
  });

  it("returns admin_lookup_failed when the Admin API throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await loadCustomerMemberstackMember({
      lookupValue: "thesmith@charter.net",
      getClient: async () => ({
        getMember: async () => {
          throw new Error("network down");
        },
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("load_error");
    expect(result.failureReason).toBe("admin_lookup_failed");
    expect(result.error).toBe("Failed to load Memberstack member data.");
    expect(result.diagnostic?.operation).toBe("getMember by email");
    expect(warn).toHaveBeenCalledWith(
      "[watson-memberstack] Admin lookup failed",
      expect.objectContaining({
        failureReason: "admin_lookup_failed",
        operation: "getMember by email",
        message: expect.stringContaining("network down"),
      }),
    );
    warn.mockRestore();
  });

  it("retains sanitized TLS diagnostics on load_error without exposing secrets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tlsError = new Error("Memberstack getMember by id fetch failed. Cause: UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    (tlsError as Error & { code?: string; fetchCause?: string }).code =
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    (tlsError as Error & { fetchCause?: string }).fetchCause =
      "Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE: unable to verify the first certificate | sk_should_not_leak";

    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_cmrq9lzwl02c70sor1uuwamcf",
      getClient: async () => ({
        getMember: async () => {
          throw tlsError;
        },
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("load_error");
    expect(result.error).toBe("Failed to load Memberstack member data.");
    expect(result.diagnostic?.operation).toBe("getMember by id");
    expect(result.diagnostic?.code).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(JSON.stringify(result.diagnostic)).not.toContain("sk_should_not_leak");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sk_should_not_leak");
    warn.mockRestore();
  });

  it("returns admin_lookup_failed for a malformed Memberstack response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    expect(result.failureReason).toBe("admin_lookup_failed");
    expect(result.error).toContain("malformed");
    warn.mockRestore();
  });

  it("returns member_not_found for a confirmed empty Admin API response", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
      failureReason: "member_not_found",
      error: "No Memberstack member found for this identifier.",
    });
    warn.mockRestore();
  });

  it("mem_sb_ member + sandbox Admin client succeeds", async () => {
    const getMember = vi.fn(async (id: string) => ({
      id,
      auth: { email: "test_active@knititnow.com" },
      planConnections: [
        {
          id: "con_1",
          active: true,
          status: "ACTIVE",
          planId: "pln_monthly-subscription-to-knititnow-webx0nz5",
        },
      ],
    }));

    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_sb_cmrw4wref06jb0tv923kw5dq2",
      secretKey: "sk_sb_sandbox_test_key",
      getClient: async (key) => {
        expect(key).toBe("sk_sb_sandbox_test_key");
        return {
          getMember,
          listMembers: async () => ({ data: [], hasNextPage: false }),
        };
      },
    });

    expect(getMember).toHaveBeenCalledWith("mem_sb_cmrw4wref06jb0tv923kw5dq2");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.id).toBe("mem_sb_cmrw4wref06jb0tv923kw5dq2");
    }
  });

  it("mem_sb_ member + live Admin client returns explicit environment_mismatch", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const getMember = vi.fn(async () => ({
      id: "should_not_be_called",
      planConnections: [],
    }));

    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_sb_cmrw4wref06jb0tv923kw5dq2",
      secretKey: "sk_live_only_secret_value",
      getClient: async () => ({
        getMember,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(getMember).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("environment_mismatch");
    }
    expect(JSON.stringify(result)).not.toContain("sk_live_only_secret_value");
    expect(JSON.stringify(error.mock.calls)).not.toContain("sk_live_only_secret_value");
    expect(JSON.stringify(error.mock.calls)).toContain("environment mismatch");
    error.mockRestore();
  });

  it("live mem_ member + live Admin client succeeds", async () => {
    const getMember = vi.fn(async (id: string) => ({
      id,
      auth: { email: "live@example.com" },
      planConnections: [],
    }));

    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_cmrq9lzwl02c70sor1uuwamcf",
      secretKey: "sk_live_admin_secret",
      getClient: async () => ({
        getMember,
        listMembers: async () => ({ data: [], hasNextPage: false }),
      }),
    });

    expect(getMember).toHaveBeenCalledWith("mem_cmrq9lzwl02c70sor1uuwamcf");
    expect(result.ok).toBe(true);
  });

  it("default Admin path uses bare getMemberstackAdminClient() like requireMember", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getMember = vi.fn(async (id: string) => ({
      id,
      auth: { email: "paid@example.com" },
      planConnections: [],
    }));
    const adminModule = await import("../../../netlify/functions/lib/memberstack-admin.js");
    const spy = vi.spyOn(adminModule, "getMemberstackAdminClient").mockReturnValue({
      getMember,
      listMembers: async () => ({ data: [], hasNextPage: false }),
      verifyMemberToken: async () => null,
    } as never);

    const result = await loadCustomerMemberstackMember({
      lookupValue: "mem_verified_shared_client",
    });

    expect(spy).toHaveBeenCalledWith();
    expect(getMember).toHaveBeenCalledWith("mem_verified_shared_client");
    expect(result.ok).toBe(true);
    spy.mockRestore();
    warn.mockRestore();
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
      failureReason: "member_not_found",
      error: MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
    });
  });
});
