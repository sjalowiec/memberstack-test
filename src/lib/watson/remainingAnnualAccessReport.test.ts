import { describe, expect, it, vi } from "vitest";

import { CURRENT_LEGACY_MEMBERS_SQL } from "./legacyMembershipReportsShared";
import {
  buildRemainingAnnualAccessReport,
  buildRemainingAnnualAccessRow,
  classifyRemainingAnnualMember,
  isObviousMonthlyMember,
  loadRemainingAnnualAccessReport,
} from "./remainingAnnualAccessReport";
import { buildBaseMemberFields } from "./legacyMembershipReportsShared";

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    memberid: "MEM-1",
    fristname: "Ann",
    lastname: "Example",
    email: "ann@example.com",
    subscriptiontype: "Single Payment",
    subscriptiondate: "2025-07-01T00:00:00.000Z",
    subscriptionexpiring: "2026-07-01T00:00:00.000Z",
    days_remaining: 20,
    monthlysubscriber: 0,
    subscriptionrenewal: 0,
    currentsubscriber: 1,
    stripcustomerid: "cus_123",
    latest_subscriptionid: 10,
    latest_amount: "228.0000",
    latest_processor: "stripe",
    latest_rate_id: "A1C5572D-E311-D637-AE12-EDE03F978083",
    latest_monthlybilling: 0,
    latest_expirationdate: "2026-07-01T00:00:00.000Z",
    latest_datebought: "2025-07-01T00:00:00.000Z",
    latest_premium: 1,
    latest_arb_id: null,
    subscription_row_count: 1,
    non_monthly_subscription_row_count: 1,
    ...overrides,
  };
}

describe("remainingAnnualAccessReport", () => {
  it("excludes obvious monthly members", () => {
    const monthly = buildBaseMemberFields(
      sampleRow({
        monthlysubscriber: 1,
        latest_amount: "19.9900",
        latest_monthlybilling: 1,
        latest_rate_id: null,
      }) as never,
    );
    expect(isObviousMonthlyMember(monthly)).toBe(true);
    expect(buildRemainingAnnualAccessRow(sampleRow({
      monthlysubscriber: 1,
      latest_amount: "19.9900",
      latest_monthlybilling: 1,
    }) as never)).toBeNull();
  });

  it("classifies confirmed annual, installment, manual, and probable", () => {
    const confirmed = buildBaseMemberFields(sampleRow() as never);
    expect(classifyRemainingAnnualMember(confirmed)).toBe("confirmed_annual_single");

    const installment = buildBaseMemberFields(
      sampleRow({
        subscriptiontype: "Basic Membership  - Three Payments",
        latest_amount: "50.0000",
        latest_rate_id: "A3D7A352-B4E9-1F52-111B-8ED722C66FBE",
        latest_premium: 0,
      }) as never,
    );
    expect(classifyRemainingAnnualMember(installment)).toBe("annual_installment");

    const manual = buildBaseMemberFields(
      sampleRow({
        subscriptiontype: "Free",
        latest_amount: "0.0000",
        latest_processor: "Payment Request",
        latest_rate_id: null,
      }) as never,
    );
    expect(classifyRemainingAnnualMember(manual)).toBe("manual_complimentary");

    const probable = buildBaseMemberFields(
      sampleRow({
        subscriptiontype: null,
        latest_amount: "228.0000",
        latest_rate_id: null,
        latest_processor: "paypal",
      }) as never,
    );
    expect(classifyRemainingAnnualMember(probable)).toBe("probable_annual_single");
  });

  it("does not describe auto-renewal and keeps classification breakdown", () => {
    const report = buildRemainingAnnualAccessReport(
      [
        sampleRow(),
        sampleRow({
          memberid: "MEM-2",
          subscriptiontype: "Free",
          latest_amount: "0",
          latest_processor: "Payment Request",
          latest_rate_id: null,
        }),
        sampleRow({
          memberid: "MEM-3",
          monthlysubscriber: 1,
          latest_monthlybilling: 1,
          latest_amount: "19.99",
        }),
      ] as never[],
      new Date("2026-07-16T12:00:00.000Z"),
    );

    expect(report.rows).toHaveLength(2);
    expect(report.summary.confirmedAnnualSingle).toBe(1);
    expect(report.summary.manualComplimentary).toBe(1);
    expect(report.note).toContain("did not automatically renew");
    expect(report.note).toContain("not as one combined annual count");
    expect(report.rows[0]?.paidThroughDisplay).toBeTruthy();
    expect(report.rows[0]?.requiresManualMigration).toBeTypeOf("boolean");
  });

  it("loads through the shared current-member query", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([sampleRow()]);
    const report = await loadRemainingAnnualAccessReport(queryFn);
    expect(queryFn).toHaveBeenCalledWith(CURRENT_LEGACY_MEMBERS_SQL);
    expect(report.summary.confirmedAnnualSingle).toBe(1);
  });
});
