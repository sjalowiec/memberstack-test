import { describe, expect, it } from "vitest";

import {
  COMPLIMENTARY_MEMBERSHIPS,
  FREE_ACCESS_MEMBERSHIPS,
  MEMBERSHIPS,
} from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import type { ExpiredLegacyWatsonRow } from "./expiredLegacyMembersReport";
import { summarizeLegacyMembershipEndDate } from "./legacyMembershipEndDate";

const LEGACY = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const COMP = COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;

function member(id: string, email: string, plans: string[]): MemberstackMember {
  return {
    id,
    auth: { email, firstName: email.split("@")[0] },
    planConnections: plans.map((planId) => ({ planId, status: "ACTIVE", active: true })),
  };
}

function watson(
  memberid: string,
  email: string,
  paidThrough: string | null,
  name = "Member",
): ExpiredLegacyWatsonRow {
  return {
    memberid,
    first_name: name,
    last_name: "Person",
    email,
    paid_through_ymd: paidThrough,
  };
}

describe("legacy membership end date", () => {
  it("uses the latest non-staff date and a separate date for people still on legacy access", () => {
    const report = summarizeLegacyMembershipEndDate({
      members: [
        member("late-paid", "late@example.com", [LEGACY, PAID]),
        member("legacy", "legacy@example.com", [LEGACY]),
        member("comp", "comp@example.com", [LEGACY, COMP]),
        member("staff", "staff@knititnow.com", [LEGACY]),
        member("missing", "missing@example.com", [LEGACY]),
        member("staff-missing", "test1@knititnow.com", [LEGACY]),
      ],
      watsonRows: [
        watson("1", "late@example.com", "2027-06-01", "Late"),
        watson("2", "legacy@example.com", "2027-01-15", "Legacy"),
        watson("3", "comp@example.com", "2027-03-01", "Comp"),
        watson("4", "staff@knititnow.com", "2028-01-01", "Staff"),
      ],
      complimentaryByMemberstackId: new Map([["comp", "2027-04-01"]]),
    });

    expect(report.latestConfirmed.paidThrough).toBe("2027-06-01");
    expect(report.latestConfirmed.members.map((row) => row.email)).toEqual(["late@example.com"]);
    expect(report.latestConfirmed.members[0]).toMatchObject({
      paidMembership: true,
      complimentaryBeyondLegacy: false,
    });
    expect(report.nextConfirmed.paidThrough).toBe("2027-03-01");
    expect(report.nextConfirmed.members.map((row) => row.email)).toEqual(["comp@example.com"]);
    expect(report.latestStillOnLegacy.paidThrough).toBe("2027-01-15");
    expect(report.nextStillOnLegacy.paidThrough).toBe(null);
    expect(report.latestStillOnLegacy.members.map((row) => row.email)).toEqual([
      "legacy@example.com",
    ]);
    expect(report.unresolved.map((row) => row.email)).toEqual(["missing@example.com"]);
    expect(report.staffOrTest.latestConfirmed.paidThrough).toBe("2028-01-01");
    expect(report.staffOrTest.unresolved.map((row) => row.email)).toEqual(["test1@knititnow.com"]);
  });

  it("keeps a member on legacy access when complimentary ends on the legacy date", () => {
    const report = summarizeLegacyMembershipEndDate({
      members: [member("same", "same@example.com", [LEGACY, COMP])],
      watsonRows: [watson("1", "same@example.com", "2027-02-01")],
      complimentaryByMemberstackId: new Map([["same", "2027-02-01"]]),
    });
    expect(report.latestStillOnLegacy.paidThrough).toBe("2027-02-01");
    expect(report.latestStillOnLegacy.members[0]?.complimentaryBeyondLegacy).toBe(false);
  });
});
