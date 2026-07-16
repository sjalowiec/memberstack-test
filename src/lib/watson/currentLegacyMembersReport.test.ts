import { describe, expect, it, vi } from "vitest";

import {
  buildCurrentLegacyMemberRow,
  buildCurrentLegacyMembersReport,
  CURRENT_LEGACY_MEMBERS_CSV_HEADERS,
  currentLegacyMemberRowToCsvCells,
  loadCurrentLegacyMembersReport,
} from "./currentLegacyMembersReport";
import {
  BLANK_SUBSCRIPTION_TYPE_LABEL,
  CURRENT_LEGACY_MEMBERS_SQL,
} from "./legacyMembershipReportsShared";

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    memberid: "MEM-1",
    fristname: "Ann",
    lastname: "Example",
    email: "ann@example.com",
    subscriptiontype: "Basic Membership",
    subscriptiondate: "2025-07-01T00:00:00.000Z",
    subscriptionexpiring: "2026-07-01T00:00:00.000Z",
    days_remaining: 20,
    monthlysubscriber: 0,
    subscriptionrenewal: 1,
    currentsubscriber: 1,
    stripcustomerid: "cus_123",
    latest_subscriptionid: 10,
    latest_amount: "144.0000",
    latest_processor: "stripe",
    latest_rate_id: "A3B982C4-C38B-ADBE-976E-74BF7E206134",
    latest_monthlybilling: 0,
    latest_expirationdate: "2026-07-01T00:00:00.000Z",
    latest_datebought: "2025-07-01T00:00:00.000Z",
    latest_premium: 0,
    latest_arb_id: null,
    subscription_row_count: 1,
    non_monthly_subscription_row_count: 1,
    ...overrides,
  };
}

describe("currentLegacyMembersReport", () => {
  it("uses Matthew current-member SQL on legacy_members", () => {
    expect(CURRENT_LEGACY_MEMBERS_SQL).toContain("COALESCE(m.betaactive, 0) = 0");
    expect(CURRENT_LEGACY_MEMBERS_SQL).toContain(
      "m.subscriptionexpiring::date >= CURRENT_DATE",
    );
    expect(CURRENT_LEGACY_MEMBERS_SQL).toContain("DISTINCT ON (s.memberid_fk)");
  });

  it("labels blank subscription types for display", () => {
    const row = buildCurrentLegacyMemberRow(
      sampleRow({ subscriptiontype: null }) as never,
    );
    expect(row.subscriptionTypeDisplay).toBe(BLANK_SUBSCRIPTION_TYPE_LABEL);
    expect(row.exceptions).toContain("missing_type");
  });

  it("builds summary counts and CSV cells", () => {
    const report = buildCurrentLegacyMembersReport(
      [
        sampleRow(),
        sampleRow({
          memberid: "MEM-2",
          subscriptiontype: null,
          monthlysubscriber: 1,
          days_remaining: 10,
          stripcustomerid: null,
          latest_amount: "19.9900",
          latest_processor: null,
          latest_rate_id: null,
          latest_monthlybilling: 1,
        }),
      ] as never[],
      new Date("2026-07-16T12:00:00.000Z"),
    );

    expect(report.summary.totalMembers).toBe(2);
    expect(report.summary.monthlyCount).toBe(1);
    expect(report.summary.nonMonthlyCount).toBe(1);
    expect(report.summary.expiring30).toBe(2);
    expect(report.summary.withStripeCustomerId).toBe(1);
    expect(report.summary.bySubscriptionType[0]?.type).toBeDefined();
    expect(currentLegacyMemberRowToCsvCells(report.rows[0])).toHaveLength(
      CURRENT_LEGACY_MEMBERS_CSV_HEADERS.length,
    );
    expect(report.note).toContain("not claimed to be perfectly accurate");
  });

  it("loads through the shared query", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([sampleRow()]);
    const report = await loadCurrentLegacyMembersReport(queryFn);
    expect(queryFn).toHaveBeenCalledWith(CURRENT_LEGACY_MEMBERS_SQL);
    expect(report.rows).toHaveLength(1);
  });
});
