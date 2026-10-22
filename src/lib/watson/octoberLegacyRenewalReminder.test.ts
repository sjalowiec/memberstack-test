import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

import {
  FREE_ACCESS_MEMBERSHIPS,
  MEMBERSHIPS,
} from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  OCTOBER_LEGACY_IDENTITY_SQL,
  OCTOBER_LEGACY_RENEWAL_END_YMD,
  OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL,
  OCTOBER_LEGACY_RENEWAL_START_YMD,
  buildOctoberLegacyRenewalReminder,
  buildOctoberMemberstackEmailIndex,
  evaluatePaidCoverageBeyondLegacyDate,
  filterOctoberReminderReadyRows,
  liveMemberstackAdminSecret,
  loadOctoberLegacyRenewalReminder,
  octoberReminderReadyRowsToCsv,
  resolveOctoberMemberstackMember,
  type OctoberLegacyIdentityRow,
  type OctoberLegacyRenewalQueryRow,
  type OctoberMemberstackCheck,
} from "./octoberLegacyRenewalReminder";

const ANNUAL_RATE = "A1C5572D-E311-D637-AE12-EDE03F978083";
const PAID_PLAN = MEMBERSHIPS.membership.memberstackPlanId;
const MONTHLY_PRICE = MEMBERSHIPS.membership.prices.monthly.memberstackPriceId;
const FREE_PLAN = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const TODAY = "2026-10-03";

function queryRow(overrides: Partial<OctoberLegacyRenewalQueryRow> = {}): OctoberLegacyRenewalQueryRow {
  return {
    memberid: "MEM-1",
    fristname: "Ann",
    lastname: "Example",
    email: "ann@example.com",
    subscriptiontype: "Single Payment",
    subscriptiondate: "2025-10-15T07:00:00.000Z",
    subscriptionexpiring: "2026-10-15T07:00:00.000Z",
    days_remaining: null,
    monthlysubscriber: 0,
    subscriptionrenewal: 0,
    currentsubscriber: 1,
    stripcustomerid: null,
    latest_subscriptionid: 10,
    latest_amount: "228.0000",
    latest_processor: "stripe",
    latest_rate_id: ANNUAL_RATE,
    latest_monthlybilling: 0,
    latest_expirationdate: "2026-10-15T07:00:00.000Z",
    latest_datebought: "2025-10-15T07:00:00.000Z",
    latest_premium: 1,
    latest_arb_id: null,
    subscription_row_count: 1,
    non_monthly_subscription_row_count: 1,
    betaactive: 0,
    paid_through_ymd: "2026-10-15",
    ...overrides,
  };
}

function completeIndex(members: MemberstackMember[]): OctoberMemberstackCheck {
  return { status: "complete", index: buildOctoberMemberstackEmailIndex(members) };
}

function build(options: {
  rows?: OctoberLegacyRenewalQueryRow[];
  identityRows?: OctoberLegacyIdentityRow[];
  memberstack?: OctoberMemberstackCheck;
  today?: string;
} = {}) {
  return buildOctoberLegacyRenewalReminder({
    queryRows: options.rows ?? [queryRow()],
    identityRows: options.identityRows ?? [
      { memberid: "MEM-1", email: "ann@example.com" },
    ],
    memberstack: options.memberstack ?? completeIndex([]),
    todayLosAngeles: options.today ?? TODAY,
  });
}

function paidMember(
  email: string,
  payment: MemberstackMember["planConnections"] extends Array<infer T> | undefined
    ? T extends { payment?: infer P }
      ? P
      : never
    : never,
  id = "mem_paid",
): MemberstackMember {
  return {
    id,
    auth: { email },
    planConnections: [
      {
        active: true,
        status: "ACTIVE",
        planId: PAID_PLAN,
        payment: payment ?? undefined,
      },
    ],
  };
}

describe("october legacy renewal reminder", () => {
  it("selects October 1–31 in America/Los_Angeles, including dates already passed", () => {
    expect(OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL).toContain(
      "timezone('America/Los_Angeles', m.subscriptionexpiring)",
    );
    expect(OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL).toContain("BETWEEN $1::date AND $2::date");
    expect(OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL).not.toContain("CURRENT_DATE");
    expect(OCTOBER_LEGACY_IDENTITY_SQL).toContain("ANY($1::text[])");

    const report = build({
      rows: [
        queryRow({ memberid: "EARLY", email: "early@example.com", paid_through_ymd: "2026-10-01" }),
        queryRow({ memberid: "LATE", email: "late@example.com", paid_through_ymd: "2026-10-31" }),
        queryRow({ memberid: "TODAY", email: "today@example.com", paid_through_ymd: "2026-10-03" }),
      ],
      identityRows: [
        { memberid: "EARLY", email: "early@example.com" },
        { memberid: "LATE", email: "late@example.com" },
        { memberid: "TODAY", email: "today@example.com" },
      ],
    });

    expect(report.reminderRows.map((row) => [row.memberid, row.statusLabel])).toEqual([
      ["EARLY", "Expired"],
      ["TODAY", "Upcoming"],
      ["LATE", "Upcoming"],
    ]);
    expect(report.summary.reminderExpired).toBe(1);
    expect(report.summary.reminderUpcoming).toBe(2);
  });

  it("keeps a verified annual member with no paid plan on the reminder list", () => {
    const noAccount = build();
    expect(noAccount.reminderRows).toHaveLength(1);
    expect(noAccount.reminderRows[0]?.evidence).toContain("No Memberstack account");
    expect(noAccount.reminderRows[0]?.evidence).toContain("Verified annual single payment");

    const freeLegacy = build({
      memberstack: completeIndex([
        {
          id: "mem_free",
          auth: { email: "ann@example.com" },
          planConnections: [{ active: true, status: "ACTIVE", planId: FREE_PLAN }],
        },
      ]),
    });
    expect(freeLegacy.reminderRows).toHaveLength(1);
    expect(freeLegacy.reminderRows[0]?.evidence).toContain("free legacy plan");
    expect(freeLegacy.reminderRows[0]?.evidence).not.toContain("current paid membership keeps");
  });

  it("excludes paid coverage that lasts past the legacy date, using Los Angeles cancellation days", () => {
    const renewing = build({
      memberstack: completeIndex([
        paidMember("ann@example.com", {
          priceId: MONTHLY_PRICE,
          cancelAtDate: null,
        }),
      ]),
    });
    expect(renewing.reminderRows).toHaveLength(0);
    expect(renewing.reviewRows).toHaveLength(0);
    expect(renewing.summary.excludedPaidCoverage).toBe(1);
    expect(renewing.summary.excludedPaidRenewing).toBe(1);

    const laterCancel = Math.floor(Date.parse("2026-11-02T07:00:00.000Z") / 1000);
    const afterLegacy = build({
      memberstack: completeIndex([
        paidMember("ann@example.com", {
          priceId: MONTHLY_PRICE,
          cancelAtDate: laterCancel,
        }),
      ]),
    });
    expect(afterLegacy.summary.excludedPaidCoverage).toBe(1);

    const sameDay = Math.floor(Date.parse("2026-10-16T06:59:00.000Z") / 1000);
    const endsOnLegacyDay = evaluatePaidCoverageBeyondLegacyDate(
      paidMember("ann@example.com", { priceId: MONTHLY_PRICE, cancelAtDate: sameDay }),
      "2026-10-15",
    );
    expect(endsOnLegacyDay.kind).toBe("does_not_cover_beyond");

    const included = build({
      memberstack: completeIndex([
        paidMember("ann@example.com", { priceId: MONTHLY_PRICE, cancelAtDate: sameDay }),
      ]),
    });
    expect(included.reminderRows).toHaveLength(1);
    expect(included.summary.excludedPaidCoverage).toBe(0);
  });

  it("puts unverified paid status in review and leaves it out of the CSV", () => {
    const missingPayment = build({
      memberstack: completeIndex([paidMember("ann@example.com", null)]),
    });
    expect(missingPayment.reminderRows).toHaveLength(0);
    expect(missingPayment.reviewRows[0]?.reviewReason).toBe("paid_status_unverified");

    const unavailable = build({
      memberstack: {
        status: "unavailable",
        detail: "The Memberstack member scan was incomplete, so current paid status could not be verified.",
      },
    });
    expect(unavailable.reminderRows).toHaveLength(0);
    expect(unavailable.reviewRows[0]?.reviewReason).toBe("paid_status_unverified");
    expect(octoberReminderReadyRowsToCsv(unavailable.reminderRows)).toBe(
      "Name,Email,Legacy paid-through date,Status,Evidence\r\n",
    );

    const ambiguous = build({
      memberstack: completeIndex([
        { id: "mem_a", auth: { email: "ann@example.com" }, planConnections: [] },
        { id: "mem_b", auth: { email: "ann@example.com" }, planConnections: [] },
      ]),
    });
    expect(ambiguous.reminderRows).toHaveLength(0);
    expect(ambiguous.reviewRows[0]?.reviewReason).toBe("conflicting_records");
  });

  it("keeps installment, probable, manual, and unresolved records out of the reminder CSV", () => {
    const report = build({
      rows: [
        queryRow({
          memberid: "INST",
          email: "inst@example.com",
          latest_amount: "50.0000",
          latest_rate_id: null,
          subscriptiontype: "Something else",
        }),
        queryRow({
          memberid: "PROB",
          email: "prob@example.com",
          latest_amount: "228.0000",
          latest_rate_id: null,
        }),
        queryRow({
          memberid: "FREE",
          email: "free@example.com",
          subscriptiontype: "Free",
          latest_amount: "0",
          latest_processor: "Payment Request",
          latest_rate_id: null,
        }),
        queryRow({
          memberid: "UNK",
          email: "unk@example.com",
          subscriptiondate: "2026-10-01T07:00:00.000Z",
          latest_amount: "12.0000",
          latest_rate_id: null,
          subscriptiontype: "Workshop",
        }),
      ],
      identityRows: [],
    });

    expect(report.reminderRows).toHaveLength(0);
    expect(report.reviewRows.map((row) => row.reviewReason)).toEqual([
      "manual_complimentary",
      "installment",
      "probable",
      "unresolved",
    ]);
    expect(report.reviewRows.find((row) => row.memberid === "INST")?.evidence).toContain(
      "amount alone",
    );
    expect(octoberReminderReadyRowsToCsv(report.reminderRows)).not.toContain("inst@example.com");
  });

  it("excludes monthly legacy records and known test accounts", () => {
    const report = build({
      rows: [
        queryRow({
          memberid: "MONTH",
          email: "month@example.com",
          monthlysubscriber: 1,
          latest_amount: "19.99",
          latest_monthlybilling: 1,
          latest_rate_id: null,
        }),
        queryRow({
          memberid: "STAFF",
          email: "helper@knititnow.com",
        }),
        queryRow({
          memberid: "BETA",
          email: "beta@example.com",
          betaactive: 1,
        }),
      ],
      identityRows: [{ memberid: "MONTH", email: "month@example.com" }],
    });

    expect(report.reminderRows).toHaveLength(0);
    expect(report.reviewRows).toHaveLength(0);
    expect(report.summary.excludedMonthly).toBe(1);
    expect(report.summary.excludedTest).toBe(2);
  });

  it("flags duplicate people and shared Memberstack identities for review", () => {
    const duplicateEmail = build({
      rows: [queryRow(), queryRow({ memberid: "MEM-2", fristname: "Ann", lastname: "Other" })],
      identityRows: [
        { memberid: "MEM-1", email: "ann@example.com" },
        { memberid: "MEM-2", email: "ann@example.com" },
      ],
    });
    expect(duplicateEmail.reminderRows).toHaveLength(0);
    expect(duplicateEmail.reviewRows).toHaveLength(2);
    expect(duplicateEmail.reviewRows.every((row) => row.reviewReason === "conflicting_records")).toBe(
      true,
    );

    const sharedPerson = build({
      rows: [
        queryRow({ memberid: "MEM-1", email: "ann@example.com" }),
        queryRow({ memberid: "MEM-9", email: "ann.other@example.com", paid_through_ymd: "2026-10-20" }),
      ],
      identityRows: [
        { memberid: "MEM-1", email: "ann@example.com" },
        { memberid: "MEM-9", email: "ann.other@example.com" },
      ],
      memberstack: completeIndex([
        { id: "mem_same", auth: { email: "ann@example.com" }, planConnections: [] },
        { id: "mem_same", auth: { email: "ann.other@example.com" }, planConnections: [] },
      ]),
    });
    expect(sharedPerson.reminderRows).toHaveLength(0);
    expect(sharedPerson.reviewRows).toHaveLength(2);
    expect(sharedPerson.reviewRows[0]?.evidence).toContain("mem_same");
  });

  it("treats a Gmail alias as the same person when the paid plan covers past the legacy date", () => {
    const index = buildOctoberMemberstackEmailIndex([
      paidMember("ann@googlemail.com", { priceId: MONTHLY_PRICE, cancelAtDate: null }, "mem_alias"),
    ]);
    expect(resolveOctoberMemberstackMember(index, "ann@gmail.com").status).toBe("unique");

    const report = build({
      rows: [queryRow({ email: "ann@gmail.com" })],
      identityRows: [{ memberid: "MEM-1", email: "ann@gmail.com" }],
      memberstack: { status: "complete", index },
    });
    expect(report.reminderRows).toHaveLength(0);
    expect(report.summary.excludedPaidCoverage).toBe(1);
  });

  it("exports only the filtered reminder-ready rows", () => {
    const report = build({
      rows: [
        queryRow({ memberid: "EARLY", email: "early@example.com", paid_through_ymd: "2026-10-01" }),
        queryRow({ memberid: "LATE", email: "late@example.com", paid_through_ymd: "2026-10-31" }),
        queryRow({
          memberid: "INST",
          email: "inst@example.com",
          paid_through_ymd: "2026-10-10",
          latest_amount: "50",
          latest_rate_id: null,
        }),
      ],
      identityRows: [
        { memberid: "EARLY", email: "early@example.com" },
        { memberid: "LATE", email: "late@example.com" },
      ],
    });
    const filtered = filterOctoberReminderReadyRows(report.reminderRows, { status: "expired" });
    const csv = octoberReminderReadyRowsToCsv(filtered);
    const lines = csv.trim().split(/\r\n/);

    expect(filtered.map((row) => row.email)).toEqual(["early@example.com"]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Name,Email,Legacy paid-through date,Status,Evidence");
    expect(lines[1]).toContain("early@example.com");
    expect(lines[1]).toContain("Expired");
    expect(lines[1]).toContain("October 1, 2026");
    expect(csv).not.toContain("late@example.com");
    expect(csv).not.toContain("inst@example.com");
    expect(filtered[0]?.evidence).toBe(
      report.reminderRows.find((row) => row.memberid === "EARLY")?.evidence,
    );

    const component = fs.readFileSync(
      path.resolve("src/components/watson/WatsonOctoberLegacyRenewalReminder.astro"),
      "utf8",
    );
    expect(component).toContain('querySelectorAll<HTMLTableRowElement>("[data-reminder-row]")');
    expect(component).toContain(".filter((row) => !row.hidden)");
    expect(component).toContain("data-review-row");
    expect(component).not.toContain('querySelectorAll<HTMLTableRowElement>("[data-review-row]")');
  });

  it("uses only a live Memberstack admin key for the paid-membership check", () => {
    expect(liveMemberstackAdminSecret({ MEMBERSTACK_SECRET_KEY: "sk_live_example" })).toBe(
      "sk_live_example",
    );
    expect(liveMemberstackAdminSecret({ MEMBERSTACK_SECRET_KEY: "sk_sb_sandbox" })).toBeNull();
    expect(
      liveMemberstackAdminSecret({
        MEMBERSTACK_SECRET_KEY: "",
        MEMBERSTACK_SANDBOX_SECRET_KEY: "sk_sb_sandbox",
      }),
    ).toBeNull();
  });

  it("fails closed when the Memberstack scan is truncated and skips the scan when nobody qualifies", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([queryRow()]).mockResolvedValueOnce([
      { memberid: "MEM-1", email: "ann@example.com" },
    ]);
    const loadMemberstackMembers = vi.fn().mockResolvedValue({ members: [], truncated: true });
    const report = await loadOctoberLegacyRenewalReminder({
      now: new Date("2026-10-03T17:00:00.000Z"),
      queryFn,
      loadMemberstackMembers,
    });

    expect(queryFn).toHaveBeenNthCalledWith(1, OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL, [
      OCTOBER_LEGACY_RENEWAL_START_YMD,
      OCTOBER_LEGACY_RENEWAL_END_YMD,
    ]);
    expect(report.todayLosAngeles).toBe("2026-10-03");
    expect(report.reminderRows).toHaveLength(0);
    expect(report.reviewRows[0]?.reviewReason).toBe("paid_status_unverified");
    expect(loadMemberstackMembers).toHaveBeenCalledOnce();

    const emptyQuery = vi.fn().mockResolvedValueOnce([]);
    const unusedScan = vi.fn();
    const empty = await loadOctoberLegacyRenewalReminder({
      queryFn: emptyQuery,
      loadMemberstackMembers: unusedScan,
    });
    expect(empty.reminderRows).toHaveLength(0);
    expect(unusedScan).not.toHaveBeenCalled();
    expect(emptyQuery).toHaveBeenCalledOnce();
  });
});
