import { describe, expect, it } from "vitest";

import { COMPLIMENTARY_MEMBERSHIPS, FREE_ACCESS_MEMBERSHIPS, LEGACY_MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  classifyExpiredLegacyMembers,
  daysSincePaidThrough,
  type ExpiredLegacyWatsonRow,
} from "./expiredLegacyMembersReport";

const LEGACY = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const COMP = COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;
const ANNUAL = LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId;
const TODAY = "2026-10-05";

function member(
  id: string,
  email: string,
  plans: string[],
  name: { firstName?: string; lastName?: string } = {},
): MemberstackMember {
  return {
    id,
    auth: { email, ...name },
    planConnections: plans.map((planId) => ({ planId, status: "ACTIVE", active: true })),
  };
}

function watson(partial: Partial<ExpiredLegacyWatsonRow> & Pick<ExpiredLegacyWatsonRow, "memberid" | "email">): ExpiredLegacyWatsonRow {
  return {
    first_name: null,
    last_name: null,
    paid_through_ymd: null,
    ...partial,
  };
}

describe("expired legacy members", () => {
  it("counts calendar days before today", () => {
    expect(daysSincePaidThrough("2026-10-05", "2026-10-01")).toBe(4);
  });

  it("separates uncovered, covered, and unresolved members", () => {
    const report = classifyExpiredLegacyMembers({
      todayYmd: TODAY,
      members: [
        member("expired", "open@example.com", [LEGACY], { firstName: "Memberstack" }),
        member("paid", "paid@example.com", [LEGACY, ANNUAL]),
        member("comp", "comp@example.com", [LEGACY, COMP]),
        member("current", "current@example.com", [LEGACY]),
        member("today", "today@example.com", [LEGACY]),
        member("missing", "missing@example.com", [LEGACY], { firstName: "No", lastName: "Match" }),
        member("nodate", "nodate@example.com", [LEGACY]),
        member("two", "two@example.com", [LEGACY]),
        member("inactive", "inactive@example.com", []),
      ],
      watsonRows: [
        watson({ memberid: "w1", email: "open@example.com", first_name: "Ada", last_name: "Open", paid_through_ymd: "2026-10-01" }),
        watson({ memberid: "w2", email: "paid@example.com", first_name: "Bea", last_name: "Paid", paid_through_ymd: "2026-09-01" }),
        watson({ memberid: "w3", email: "comp@example.com", first_name: "Cam", last_name: "Comp", paid_through_ymd: "2026-08-01" }),
        watson({ memberid: "w4", email: "current@example.com", first_name: "Future", paid_through_ymd: "2026-12-01" }),
        watson({ memberid: "w5", email: "today@example.com", paid_through_ymd: TODAY }),
        watson({ memberid: "w6", email: "nodate@example.com", first_name: "No", last_name: "Date" }),
        watson({ memberid: "w7", email: "two@example.com", first_name: "One", paid_through_ymd: "2026-01-01" }),
        watson({ memberid: "w8", email: "two@example.com", first_name: "Two", paid_through_ymd: "2026-02-01" }),
      ],
      complimentaryByMemberstackId: new Map([["comp", "2026-10-05"]]),
    });

    expect(report.expired.map((row) => row.email)).toEqual([
      "comp@example.com",
      "paid@example.com",
      "open@example.com",
    ]);
    expect(report.expired.find((row) => row.email === "open@example.com")).toMatchObject({
      name: "Ada Open",
      paidThrough: "2026-10-01",
      daysSinceExpiration: 4,
      paidMembership: "no",
      complimentaryAccess: false,
    });
    expect(report.expired.find((row) => row.email === "paid@example.com")?.paidMembership).toBe(
      "annual",
    );
    expect(report.expired.find((row) => row.email === "comp@example.com")?.complimentaryAccess).toBe(
      true,
    );
    expect(report.unresolved.map((row) => `${row.email}:${row.reason}`)).toEqual([
      "missing@example.com:no Watson match",
      "nodate@example.com:no paid-through date",
      "two@example.com:more than one Watson member",
    ]);
  });

  it("does not treat a past complimentary date as current access", () => {
    const report = classifyExpiredLegacyMembers({
      todayYmd: TODAY,
      members: [member("old", "old@example.com", [LEGACY, COMP])],
      watsonRows: [
        watson({
          memberid: "w",
          email: "old@example.com",
          paid_through_ymd: "2026-09-01",
        }),
      ],
      complimentaryByMemberstackId: new Map([["old", "2026-09-15"]]),
    });
    expect(report.expired[0]?.complimentaryAccess).toBe(false);
  });
});
