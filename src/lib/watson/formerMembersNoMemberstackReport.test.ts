import { describe, expect, it, vi } from "vitest";

import type { MemberstackMember } from "../membership/membershipSummary";
import {
  EMAIL_LIST_QUALIFICATION_REASON,
  FORMER_MEMBERS_EMAIL_CSV_HEADERS,
  FORMER_MEMBERS_LOOKBACK_MONTHS,
  FORMER_MEMBERS_NO_MEMBERSTACK_SQL,
  FormerMembersReportIncompleteScanError,
  MEMBERSTACK_NOT_FOUND_RESULT,
  classifyFormerMemberCandidates,
  formerMemberEmailRowToCsvCells,
  formerMembersEmailListToCsv,
  isValidReportEmail,
  loadFormerMembersNoMemberstackReport,
  subtractMonthsYmd,
  type FormerMemberCandidateRow,
} from "./formerMembersNoMemberstackReport";

/** Fixed instant -> America/Los_Angeles calendar day 2026-08-10. */
const NOW = new Date("2026-08-10T19:00:00Z");

function candidate(
  overrides: Partial<FormerMemberCandidateRow> = {},
): FormerMemberCandidateRow {
  return {
    memberid: "MEM-1",
    fristname: "Ann",
    lastname: "Example",
    email: "ann@example.com",
    subscriptionexpiring: "2026-03-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("formerMembersNoMemberstackReport", () => {
  it("defines an eight-month Watson paid-through window SQL", () => {
    expect(FORMER_MEMBERS_LOOKBACK_MONTHS).toBe(8);
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain(
      "m.subscriptionexpiring::date < $1::date",
    );
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain(
      "m.subscriptionexpiring::date >= $2::date",
    );
    expect(FORMER_MEMBERS_NO_MEMBERSTACK_SQL).toContain("legacy_members");
  });

  it("subtracts calendar months for the lookback lower bound", () => {
    expect(subtractMonthsYmd("2026-08-10", 8)).toBe("2025-12-10");
    expect(subtractMonthsYmd("2026-05-15", 1)).toBe("2026-04-15");
  });

  it("accepts only normalized email-like addresses", () => {
    expect(isValidReportEmail("  Sue@Example.com ")).toBe("sue@example.com");
    expect(isValidReportEmail("not-an-email")).toBeNull();
    expect(isValidReportEmail("")).toBeNull();
    expect(isValidReportEmail(null)).toBeNull();
  });

  it("puts strict not_found rows on the email list only", () => {
    const classified = classifyFormerMemberCandidates(
      [
        candidate({ memberid: "A", email: "a@x.com" }),
        candidate({ memberid: "B", email: "b@x.com" }),
        candidate({ memberid: "C", email: "c@x.com" }),
        candidate({ memberid: "D", email: "d@x.com" }),
        candidate({ memberid: "E", email: null }),
        candidate({
          memberid: "F1",
          email: "dup@x.com",
          subscriptionexpiring: "2026-02-01T00:00:00.000Z",
        }),
        candidate({
          memberid: "F2",
          email: " Dup@x.com ",
          subscriptionexpiring: "2026-01-01T00:00:00.000Z",
        }),
      ],
      (email) => {
        if (email === "a@x.com") return { status: "not_found" };
        if (email === "b@x.com") {
          return {
            status: "unique",
            member: { id: "mem_b", auth: { email: "b@x.com" } },
          };
        }
        if (email === "c@x.com") return { status: "ambiguous" };
        if (email === "d@x.com") {
          return { status: "error", error: "admin failed" };
        }
        return { status: "not_found" };
      },
    );

    expect(classified.summary.emailList).toBe(1);
    expect(classified.emailList[0]?.memberid).toBe("A");
    expect(classified.emailList[0]?.memberstackResult).toBe(
      MEMBERSTACK_NOT_FOUND_RESULT,
    );
    expect(classified.emailList[0]?.qualificationReason).toBe(
      EMAIL_LIST_QUALIFICATION_REASON,
    );
    expect(classified.emailList[0]?.watsonStatus).toBe("Expired");

    expect(classified.summary.memberstackFound).toBe(1);
    expect(classified.memberstackFound[0]?.memberstackId).toBe("mem_b");
    expect(classified.summary.ambiguous).toBe(1);
    expect(classified.summary.lookupError).toBe(1);
    expect(classified.summary.missingOrInvalidEmail).toBe(1);
    expect(classified.summary.duplicateWatson).toBe(2);
    expect(classified.summary.watsonCandidates).toBe(7);
  });

  it("never puts unique/ambiguous/error matches on the email list", () => {
    const classified = classifyFormerMemberCandidates(
      [
        candidate({ memberid: "U", email: "u@x.com" }),
        candidate({ memberid: "M", email: "m@x.com" }),
        candidate({ memberid: "E", email: "e@x.com" }),
      ],
      (email) => {
        if (email === "u@x.com") {
          return {
            status: "unique",
            member: {
              id: "mem_u",
              planConnections: [],
            } as MemberstackMember,
          };
        }
        if (email === "m@x.com") return { status: "ambiguous" };
        return { status: "error", error: "boom" };
      },
    );

    expect(classified.emailList).toEqual([]);
    expect(classified.summary.emailList).toBe(0);
  });

  it("exports CSV only for email-list columns", () => {
    const classified = classifyFormerMemberCandidates(
      [candidate()],
      () => ({ status: "not_found" }),
    );
    const cells = formerMemberEmailRowToCsvCells(classified.emailList[0]!);
    expect(cells).toHaveLength(FORMER_MEMBERS_EMAIL_CSV_HEADERS.length);
    expect(cells[0]).toBe("Ann");
    expect(cells[1]).toBe("Example");
    expect(cells[2]).toBe("ann@example.com");
    expect(cells[4]).toBe("Expired");
    expect(cells[5]).toBe(MEMBERSTACK_NOT_FOUND_RESULT);

    const csv = formerMembersEmailListToCsv(classified.emailList);
    expect(csv).toContain("First name,Last name,Email");
    expect(csv).toContain("ann@example.com");
  });

  it("fails closed when the Memberstack scan is truncated", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([candidate()]);
    await expect(
      loadFormerMembersNoMemberstackReport({
        now: NOW,
        queryFn,
        loadMemberstackMembers: async () => ({ members: [], truncated: true }),
      }),
    ).rejects.toBeInstanceOf(FormerMembersReportIncompleteScanError);

    expect(queryFn).toHaveBeenCalledWith(FORMER_MEMBERS_NO_MEMBERSTACK_SQL, [
      "2026-08-10",
      "2025-12-10",
    ]);
  });

  it("fails closed when the Memberstack scan throws", async () => {
    await expect(
      loadFormerMembersNoMemberstackReport({
        now: NOW,
        queryFn: vi.fn().mockResolvedValueOnce([candidate()]),
        loadMemberstackMembers: async () => {
          throw new Error("admin not configured");
        },
      }),
    ).rejects.toThrow(/refusing to build the email list/i);
  });

  it("loads and classifies through shared Watson + Memberstack utilities", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([
        candidate({ memberid: "OK", email: "ok@x.com" }),
        candidate({ memberid: "HAS", email: "has@x.com" }),
      ]);

    const report = await loadFormerMembersNoMemberstackReport({
      now: NOW,
      queryFn,
      loadMemberstackMembers: async () => ({
        members: [
          {
            id: "mem_has",
            auth: { email: "has@x.com" },
            planConnections: [],
          },
        ],
        truncated: false,
      }),
    });

    expect(report.todayLosAngeles).toBe("2026-08-10");
    expect(report.windowStartYmd).toBe("2025-12-10");
    expect(report.summary.emailList).toBe(1);
    expect(report.emailList[0]?.email).toBe("ok@x.com");
    expect(report.summary.memberstackFound).toBe(1);
    expect(report.memberstackFound[0]?.memberstackId).toBe("mem_has");
    expect(report.note).toContain("Read-only");
  });

  it("supports an injected async Memberstack resolver for tests", async () => {
    const report = await loadFormerMembersNoMemberstackReport({
      now: NOW,
      queryFn: vi.fn().mockResolvedValueOnce([
        candidate({ memberid: "1", email: "gone@x.com" }),
        candidate({ memberid: "2", email: "err@x.com" }),
      ]),
      resolveMemberstackMemberByEmail: async (email) => {
        if (email === "gone@x.com") return { status: "not_found" };
        return { status: "error", error: "timeout" };
      },
    });

    expect(report.summary.emailList).toBe(1);
    expect(report.summary.lookupError).toBe(1);
  });
});
