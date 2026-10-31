import { describe, expect, it } from "vitest";

import { MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "./membershipSummary";
import {
  canonicalMembershipEmail,
  decideCurrentMembershipAccess,
} from "./currentMembershipAccess";
import { buildCurrentMembershipAccessCensus } from "./currentMembershipAccessCensus";

const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const COMPLIMENTARY = "pln_complimentary-membership-30-days-ai28093g";
const TODAY = "2026-10-31";

function member(input: {
  id?: string;
  email?: string;
  planId?: string;
  status?: string;
  cancelAtDate?: number | null;
}): MemberstackMember {
  return {
    id: input.id ?? "mem_1",
    auth: { email: input.email ?? "person@example.com" },
    planConnections: input.planId
      ? [
          {
            planId: input.planId,
            status: input.status ?? "ACTIVE",
            active: (input.status ?? "ACTIVE") === "ACTIVE" || input.status === "TRIALING",
            payment:
              input.cancelAtDate === undefined
                ? null
                : { cancelAtDate: input.cancelAtDate },
          },
        ]
      : [],
  };
}

describe("decideCurrentMembershipAccess", () => {
  it("counts a renewed paid member as yes without using the old legacy date", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({
        id: "mem_cms4sdvwk00n00ssj4ylx0x1z",
        email: "jigglybaa629@gmail.com",
        planId: PAID,
        cancelAtDate: null,
      }),
      legacyPaidThroughYmds: ["2026-10-28"],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    expect(decision).toEqual({ outcome: "yes", value: "yes" });
  });

  it("keeps yes when future billing is canceled but the plan is still active", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({
        planId: PAID,
        cancelAtDate: Math.floor(Date.now() / 1000) + 86_400,
      }),
      legacyPaidThroughYmds: ["2020-01-01"],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    expect(decision.outcome).toBe("yes");
  });

  it("counts an expired legacy member as no", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({ email: "expired@example.com" }),
      legacyPaidThroughYmds: ["2026-10-28"],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    expect(decision).toEqual({ outcome: "no", value: "no" });
  });

  it("keeps access through a legacy date that is still valid after a paid plan ends", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({ planId: PAID, status: "CANCELED" }),
      legacyPaidThroughYmds: ["2026-12-01"],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    expect(decision.outcome).toBe("yes");
  });

  it("does not treat a future legacy date as access when there is no Memberstack account", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "not_found",
      legacyPaidThroughYmds: ["2026-12-01"],
      todayYmd: TODAY,
    });
    expect(decision.outcome).toBe("no");
  });

  it("leaves conflicting legacy dates unresolved when no paid plan decides access", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({}),
      legacyPaidThroughYmds: ["2026-10-01", "2026-12-01"],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    expect(decision).toEqual({ outcome: "unresolved", reason: "conflicting_legacy_dates" });
  });

  it("does not guess when two Memberstack accounts share an email", () => {
    const decision = decideCurrentMembershipAccess({
      memberstack: "ambiguous",
      legacyPaidThroughYmds: ["2026-12-01"],
      todayYmd: TODAY,
    });
    expect(decision.outcome).toBe("unresolved");
  });

  it("counts an open complimentary plan as yes and an expired one as no", () => {
    const open = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({ planId: COMPLIMENTARY }),
      legacyPaidThroughYmds: [],
      complimentaryThroughYmd: null,
      todayYmd: TODAY,
    });
    const expired = decideCurrentMembershipAccess({
      memberstack: "unique",
      member: member({ planId: COMPLIMENTARY }),
      legacyPaidThroughYmds: ["2026-01-01"],
      complimentaryThroughYmd: "2026-10-01",
      todayYmd: TODAY,
    });
    expect(open.outcome).toBe("yes");
    expect(expired.outcome).toBe("no");
  });
});

describe("buildCurrentMembershipAccessCensus", () => {
  it("counts one person when Gmail and Googlemail rows are the same mailbox", () => {
    const census = buildCurrentMembershipAccessCensus({
      todayYmd: TODAY,
      members: [member({ id: "mem_a", email: "knit@gmail.com", planId: PAID })],
      memberstackTruncated: false,
      legacyRows: [
        { memberid: "leg_1", email: "knit@googlemail.com", paidThroughYmd: "2020-01-01" },
      ],
      complimentaryRows: [],
    });
    expect(canonicalMembershipEmail("knit@googlemail.com")).toBe("knit@gmail.com");
    expect(census.watsonYesCount).toBe(1);
    expect(census.people).toHaveLength(1);
    expect(census.people[0]?.legacyMemberIds).toEqual(["leg_1"]);
  });

  it("does not count an unresolved shared email as a current member", () => {
    const census = buildCurrentMembershipAccessCensus({
      todayYmd: TODAY,
      members: [
        member({ id: "mem_a", email: "shared@example.com", planId: PAID }),
        member({ id: "mem_b", email: "shared@example.com", planId: PAID }),
      ],
      memberstackTruncated: false,
      legacyRows: [],
      complimentaryRows: [],
    });
    expect(census.watsonYesCount).toBe(0);
    expect(census.unresolvedCount).toBe(1);
    expect(census.people[0]?.reason).toBe("ambiguous_memberstack_email");
  });
});
