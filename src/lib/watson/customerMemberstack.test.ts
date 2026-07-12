import { describe, expect, it } from "vitest";

import {
  buildCustomerMemberstackSummary,
  buildCustomerPlanConnectionDisplay,
  formatMemberstackDisplayName,
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

  it("uses Memberstack email when no name fields are available", () => {
    const member: MemberstackMember = {
      id: "mem_only",
      auth: { email: "only@example.com" },
      planConnections: [],
    };

    expect(formatMemberstackDisplayName(member)).toBe("only@example.com");
  });
});
