import { describe, expect, it, vi } from "vitest";

import { KNOWN_ANNUAL_RATE_IDS, KNOWN_INSTALLMENT_RATE_IDS } from "./legacyMembershipReportsShared";
import {
  FORMER_MEMBERS_NO_MEMBERSTACK_SQL,
  FORMER_MEMBERS_WINDOW_START_YMD,
  FormerMembersReportIncompleteScanError,
  MEMBERSTACK_NOT_FOUND_RESULT,
  QUALIFICATION_ANNUAL_INSTALLMENT,
  QUALIFICATION_CONFIRMED_ANNUAL,
  classifyFormerMemberCandidates,
  classifyFormerMemberMembershipType,
  loadFormerMembersNoMemberstackReport,
} from "./formerMembersNoMemberstackReport";

const NOW = new Date("2026-08-10T19:00:00Z");
const ANNUAL_RATE = [...KNOWN_ANNUAL_RATE_IDS][0];
const INSTALLMENT_RATE = [...KNOWN_INSTALLMENT_RATE_IDS][0];

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    memberid: "MEM-1",
    fristname: "Ann",
    lastname: "Example",
    email: "ann@example.com",
    subscriptiontype: "Premium Membership",
    subscriptiondate: "2025-01-15T00:00:00.000Z",
    subscriptionexpiring: "2026-01-15T00:00:00.000Z",
    days_remaining: -200,
    monthlysubscriber: 0,
    subscriptionrenewal: 1,
    currentsubscriber: 1,
    stripcustomerid: "cus_123",
    latest_subscriptionid: 10,
    latest_amount: "228.0000",
    latest_processor: "stripe",
    latest_rate_id: ANNUAL_RATE,
    latest_monthlybilling: 0,
    latest_expirationdate: "2026-01-15T00:00:00.000Z",
    latest_datebought: "2025-01-15T00:00:00.000Z",
    latest_premium: 1,
    latest_arb_id: null,
    subscription_row_count: 1,
    non_monthly_subscription_row_count: 1,
    ...overrides,
  };
}

describe("formerMembersNoMemberstackReport annual audience", () => {
  it("uses Nov 1 2025 paid-through window SQL", () => {
    expect(FORMER_MEMBERS_WINDOW_START_YMD).toBe("2025-11-01");
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain(
      "m.subscriptionexpiring::date < $1::date",
    );
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain(
      "m.subscriptionexpiring::date >= $2::date",
    );
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain("DISTINCT ON (s.memberid_fk)");
  });

  it("includes confirmed annual single-payment as email-list eligible type", () => {
    expect(classifyFormerMemberMembershipType(sampleRow() as never)).toBe(
      "confirmed_annual_single",
    );
  });

  it("includes annual installment as email-list eligible type", () => {
    expect(
      classifyFormerMemberMembershipType(
        sampleRow({
          subscriptiontype: "Basic Membership  - Three Payments",
          latest_amount: "80.0000",
          latest_rate_id: INSTALLMENT_RATE,
          latest_monthlybilling: 0,
        }) as never,
      ),
    ).toBe("annual_installment");
  });

  it("excludes monthlysubscriber = 1", () => {
    expect(
      classifyFormerMemberMembershipType(
        sampleRow({ monthlysubscriber: 1, latest_monthlybilling: 1, latest_amount: "19.9900" }) as never,
      ),
    ).toBe("monthly_like");
  });

  it("excludes latest monthlybilling = 1", () => {
    expect(
      classifyFormerMemberMembershipType(
        sampleRow({
          monthlysubscriber: 0,
          latest_monthlybilling: 1,
          latest_amount: "19.9900",
          latest_rate_id: null,
        }) as never,
      ),
    ).toBe("monthly_like");
  });

  it("excludes monthly amount even when flags are non-monthly", () => {
    expect(
      classifyFormerMemberMembershipType(
        sampleRow({
          monthlysubscriber: 0,
          latest_monthlybilling: 0,
          latest_amount: "19.9900",
          latest_rate_id: null,
          subscriptiontype: "Single Payment",
        }) as never,
      ),
    ).toBe("monthly_like");
  });

  it("sends unresolved non-monthly to review, not CSV", () => {
    const classified = classifyFormerMemberCandidates(
      [
        sampleRow({
          memberid: "U1",
          email: "u@x.com",
          latest_amount: "70.0000",
          latest_rate_id: null,
          latest_monthlybilling: 0,
          subscriptiontype: null,
        }) as never,
      ],
      () => ({ status: "not_found" }),
    );

    expect(classified.emailList).toEqual([]);
    expect(classified.summary.unresolvedMembershipType).toBe(1);
    expect(classified.unresolvedMembershipType[0]?.bucket).toBe(
      "unresolved_membership_type",
    );
  });

  it("puts confirmed annual not_found on the email list with annual qualification", () => {
    const classified = classifyFormerMemberCandidates(
      [sampleRow({ memberid: "A1", email: "a@x.com" }) as never],
      () => ({ status: "not_found" }),
    );

    expect(classified.summary.emailList).toBe(1);
    expect(classified.emailList[0]?.memberstackResult).toBe(MEMBERSTACK_NOT_FOUND_RESULT);
    expect(classified.emailList[0]?.qualificationReason).toBe(QUALIFICATION_CONFIRMED_ANNUAL);
    expect(classified.emailList[0]?.annualKind).toBe("confirmed_annual_single");
  });

  it("puts installment not_found on the email list with installment qualification", () => {
    const classified = classifyFormerMemberCandidates(
      [
        sampleRow({
          memberid: "I1",
          email: "i@x.com",
          subscriptiontype: "Basic Membership  - Three Payments",
          latest_amount: "80.0000",
          latest_rate_id: INSTALLMENT_RATE,
        }) as never,
      ],
      () => ({ status: "not_found" }),
    );

    expect(classified.summary.emailList).toBe(1);
    expect(classified.emailList[0]?.qualificationReason).toBe(
      QUALIFICATION_ANNUAL_INSTALLMENT,
    );
    expect(classified.emailList[0]?.annualKind).toBe("annual_installment");
  });

  it("excludes Memberstack account found from the email CSV", () => {
    const classified = classifyFormerMemberCandidates(
      [sampleRow({ memberid: "F1", email: "f@x.com" }) as never],
      () => ({
        status: "unique",
        member: { id: "mem_f", auth: { email: "f@x.com" }, planConnections: [] },
      }),
    );

    expect(classified.emailList).toEqual([]);
    expect(classified.summary.memberstackFound).toBe(1);
    expect(classified.summary.confirmedAnnualSingle).toBe(1);
  });

  it("respects the November 1 2025 cutoff via SQL bind, not expiration inference", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);
    await loadFormerMembersNoMemberstackReport({
      now: NOW,
      queryFn,
      loadMemberstackMembers: async () => ({ members: [], truncated: false }),
    });

    expect(queryFn).toHaveBeenCalledWith(FORMER_MEMBERS_NO_MEMBERSTACK_SQL, [
      "2026-08-10",
      "2025-11-01",
    ]);
  });

  it("groups email-list rows by expiration month", () => {
    const classified = classifyFormerMemberCandidates(
      [
        sampleRow({
          memberid: "M1",
          email: "m1@x.com",
          subscriptionexpiring: "2026-01-10T00:00:00.000Z",
        }) as never,
        sampleRow({
          memberid: "M2",
          email: "m2@x.com",
          subscriptionexpiring: "2026-01-20T00:00:00.000Z",
        }) as never,
        sampleRow({
          memberid: "M3",
          email: "m3@x.com",
          subscriptionexpiring: "2026-03-01T00:00:00.000Z",
        }) as never,
      ],
      () => ({ status: "not_found" }),
    );

    expect(classified.summary.emailListByExpirationMonth).toEqual([
      { month: "2026-01", count: 2 },
      { month: "2026-03", count: 1 },
    ]);
  });

  it("fails closed when the Memberstack scan is truncated", async () => {
    await expect(
      loadFormerMembersNoMemberstackReport({
        now: NOW,
        queryFn: vi.fn().mockResolvedValueOnce([sampleRow()]),
        loadMemberstackMembers: async () => ({ members: [], truncated: true }),
      }),
    ).rejects.toBeInstanceOf(FormerMembersReportIncompleteScanError);
  });

  it("fails closed when the Memberstack scan throws", async () => {
    await expect(
      loadFormerMembersNoMemberstackReport({
        now: NOW,
        queryFn: vi.fn().mockResolvedValueOnce([sampleRow()]),
        loadMemberstackMembers: async () => {
          throw new Error("admin unavailable");
        },
      }),
    ).rejects.toThrow(/refusing to build the email list/i);
  });

  it("keeps monthly-like out of Memberstack email resolution path", () => {
    const resolve = vi.fn(() => ({ status: "not_found" as const }));
    const classified = classifyFormerMemberCandidates(
      [
        sampleRow({
          memberid: "MON",
          email: "mon@x.com",
          monthlysubscriber: 1,
          latest_monthlybilling: 1,
          latest_amount: "19.9900",
        }) as never,
        sampleRow({ memberid: "ANN", email: "ann@x.com" }) as never,
      ],
      resolve,
    );

    expect(classified.summary.monthlyLike).toBe(1);
    expect(classified.summary.emailList).toBe(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("ann@x.com");
  });
});
