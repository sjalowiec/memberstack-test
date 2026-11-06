import { describe, expect, it } from "vitest";

import { buildCurrentMembershipAccessCensus } from "../membership/currentMembershipAccessCensus";
import {
  buildCurrentMembersReport,
  CURRENT_MEMBERS_REPORT_NOTE,
  CURRENT_MEMBERS_REPORT_TITLE,
} from "./currentMembersReport";

const TODAY = "2026-10-31";
const PAID = "pln_kin-membership-annual-premium-tn5b0cxj";

function member(id: string, email: string, planId: string) {
  return {
    id,
    auth: { email },
    planConnections: [{ planId, status: "ACTIVE", active: true }],
  };
}

describe("buildCurrentMembersReport", () => {
  it("lists one current member per mailbox and keeps unresolved people out of the yes count", () => {
    const census = buildCurrentMembershipAccessCensus({
      todayYmd: TODAY,
      members: [
        member("mem_paid", "renewed@gmail.com", PAID),
        member("mem_a", "shared@example.com", PAID),
        member("mem_b", "shared@example.com", PAID),
      ],
      memberstackTruncated: false,
      legacyRows: [
        { memberid: "leg_old", email: "renewed@googlemail.com", paidThroughYmd: "2020-01-01" },
      ],
      complimentaryRows: [],
    });
    const report = buildCurrentMembersReport(census);

    expect(report.title).toBe(CURRENT_MEMBERS_REPORT_TITLE);
    expect(report.note).toContain("not the Current Legacy Members report");
    expect(report.note).toBe(CURRENT_MEMBERS_REPORT_NOTE);
    expect(report.ready).toBe(true);
    expect(report.yesCount).toBe(1);
    expect(report.currentMembers).toEqual([
      {
        email: "renewed@gmail.com",
        basis: "current_paid",
        basisLabel: "Current paid membership",
        memberstackId: "mem_paid",
        legacyMemberIds: ["leg_old"],
      },
    ]);
    expect(report.unresolved).toEqual([
      {
        email: "shared@example.com",
        explanation: "More than one account uses this mailbox.",
        storedEmails: ["shared@example.com"],
      },
    ]);
    expect(report.currentMembers.map((row) => row.email)).not.toContain("shared@example.com");
  });

  it("does not publish a current-member total when Memberstack was truncated", () => {
    const census = buildCurrentMembershipAccessCensus({
      todayYmd: TODAY,
      members: [member("mem_paid", "renewed@gmail.com", PAID)],
      memberstackTruncated: true,
      legacyRows: [],
      complimentaryRows: [],
    });
    const report = buildCurrentMembersReport(census);
    expect(report.ready).toBe(false);
    expect(report.yesCount).toBe(0);
    expect(report.currentMembers).toEqual([]);
    expect(report.blockedReason).toContain("incomplete");
  });

  it("explains a Gmail and Googlemail pair with the stored addresses", () => {
    const census = buildCurrentMembershipAccessCensus({
      todayYmd: TODAY,
      members: [
        member("mem_googlemail", "s.machado84@googlemail.com", PAID),
        member("mem_gmail", "s.machado84@gmail.com", PAID),
      ],
      memberstackTruncated: false,
      legacyRows: [],
      complimentaryRows: [],
    });
    const report = buildCurrentMembersReport(census);

    expect(report.yesCount).toBe(0);
    expect(report.unresolved).toEqual([
      {
        email: "s.machado84@gmail.com",
        explanation: "Two accounts use Gmail and Googlemail versions of the same address.",
        storedEmails: ["s.machado84@googlemail.com", "s.machado84@gmail.com"],
      },
    ]);
  });
});
