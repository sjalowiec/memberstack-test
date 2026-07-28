import { describe, expect, it, vi } from "vitest";

import { createMemberstackAdminClient } from "../../../netlify/functions/lib/memberstack-admin.js";
import { MEMBERSHIPS } from "../../config/memberships";
import type { MemberstackMember } from "../membership/membershipSummary";
import type { WatsonQueryFn } from "./memberSearch";
import {
  decideLegacyPlanAction,
  LEGACY_ANNUAL_PLAN_ID,
  runLegacyAnnualExpiry,
  type MemberstackEmailResolution,
  type ResolveMemberstackMemberByEmail,
} from "./legacyAnnualExpiry";

/** Fixed instant ? America/Los_Angeles calendar day 2026-07-28 (12:00 PDT). */
const NOW = new Date("2026-07-28T19:00:00Z");

interface FakeMemberRow {
  memberid: string;
  email: string | null;
  subscriptionexpiring: string;
}

/**
 * Fake Watson query that mirrors EXPIRED_LEGACY_MEMBERS_SQL: returns rows whose
 * paid-through calendar day is strictly before the supplied LA date ($1).
 */
function makeExpiredQueryFn(rows: FakeMemberRow[]): WatsonQueryFn {
  return (async (_sql: string, params?: unknown[]) => {
    const today = String(params?.[0] ?? "");
    return rows.filter((row) => row.subscriptionexpiring.slice(0, 10) < today);
  }) as unknown as WatsonQueryFn;
}

function resolverFor(
  map: Record<string, MemberstackEmailResolution>,
): ResolveMemberstackMemberByEmail {
  return async (email: string) => map[email] ?? { status: "not_found" };
}

function member(
  planConnections: MemberstackMember["planConnections"],
): MemberstackMember {
  return { id: "mem_test", auth: { email: "member@example.com" }, planConnections };
}

const legacyOnlyMember = member([
  { planId: LEGACY_ANNUAL_PLAN_ID, active: true },
]);
const legacyPlusPaidMember = member([
  { planId: LEGACY_ANNUAL_PLAN_ID, active: true },
  { planId: MEMBERSHIPS.membership.memberstackPlanId, active: true },
]);
const inactiveLegacyMember = member([
  { planId: LEGACY_ANNUAL_PLAN_ID, status: "CANCELED" },
]);

describe("decideLegacyPlanAction", () => {
  it("removes when only the legacy plan is active", () => {
    expect(decideLegacyPlanAction(legacyOnlyMember)).toBe("remove");
  });

  it("retains when another active paid plan is present", () => {
    expect(decideLegacyPlanAction(legacyPlusPaidMember)).toBe("active_paid");
  });

  it("treats an absent/inactive legacy plan as already removed", () => {
    expect(decideLegacyPlanAction(inactiveLegacyMember)).toBe("already_removed");
    expect(decideLegacyPlanAction(member([]))).toBe("already_removed");
  });
});

describe("runLegacyAnnualExpiry - paid-through calendar boundary", () => {
  it("retains access when the paid-through date is today (LA)", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-28" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.candidatesFound).toBe(0);
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("expires access when the paid-through date was yesterday", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.candidatesFound).toBe(1);
    expect(result.legacyPlansRemoved).toBe(1);
    expect(removeLegacyPlan).toHaveBeenCalledWith(
      "mem_test",
      LEGACY_ANNUAL_PLAN_ID,
    );
  });

  it("retains access when the paid-through date is in the future", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-29" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.candidatesFound).toBe(0);
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });
});

describe("runLegacyAnnualExpiry - Memberstack decisions", () => {
  const expiredRow: FakeMemberRow = {
    memberid: "m1",
    email: "a@x.com",
    subscriptionexpiring: "2026-07-27",
  };

  it("does not remove access when another paid plan is active", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([expiredRow]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyPlusPaidMember },
      }),
      removeLegacyPlan,
    });

    expect(result.skippedActivePaid).toBe(1);
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("removes the legacy plan when it is the only access plan", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([expiredRow]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.legacyPlansRemoved).toBe(1);
    expect(removeLegacyPlan).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when the legacy plan is already absent", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([expiredRow]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: inactiveLegacyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.skippedAlreadyRemoved).toBe(1);
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("skips and reports an ambiguous Memberstack match", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([expiredRow]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "ambiguous" },
      }),
      removeLegacyPlan,
    });

    expect(result.skippedNoUniqueMatch).toBe(1);
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("skips and reports a missing Memberstack match", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([expiredRow]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "not_found" },
      }),
      removeLegacyPlan,
    });

    expect(result.skippedNoUniqueMatch).toBe(1);
    expect(result.details[0]?.reason).toBe("memberstack_not_found");
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("skips candidates with a blank email or duplicate legacy email", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "blank", email: null, subscriptionexpiring: "2026-07-27" },
        { memberid: "dupA", email: "dup@x.com", subscriptionexpiring: "2026-07-27" },
        { memberid: "dupB", email: "dup@x.com", subscriptionexpiring: "2026-07-26" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({}),
      removeLegacyPlan,
    });

    expect(result.candidatesFound).toBe(3);
    expect(result.skippedNoUniqueMatch).toBe(3);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("records a failure without aborting the batch", async () => {
    const removeLegacyPlan = vi.fn(async () => {
      throw new Error("Memberstack remove-plan failed (HTTP 500).");
    });
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
        { memberid: "m2", email: "b@x.com", subscriptionexpiring: "2026-07-27" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
        "b@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toBe(2);
    expect(result.legacyPlansRemoved).toBe(0);
  });
});

describe("runLegacyAnnualExpiry - bulk member index (default path)", () => {
  function memberWithEmail(
    id: string,
    email: string,
    planConnections: MemberstackMember["planConnections"] = [
      { planId: LEGACY_ANNUAL_PLAN_ID, active: true },
    ],
  ): MemberstackMember {
    return { id, auth: { email }, planConnections };
  }

  it("loads all members once and reconciles many candidates in memory", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const loadMemberstackMembers = vi.fn(async () => ({
      members: [
        memberWithEmail("mem_a", "a@x.com"),
        memberWithEmail("mem_b", "B@x.com"), // upper-case, must still match
        memberWithEmail("mem_other", "unrelated@x.com"),
      ],
      truncated: false,
    }));

    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
        { memberid: "m2", email: "b@x.com", subscriptionexpiring: "2026-07-26" },
        { memberid: "m3", email: "missing@x.com", subscriptionexpiring: "2026-07-25" },
      ]),
      loadMemberstackMembers,
      removeLegacyPlan,
    });

    // A single Admin scan regardless of how many candidates were reconciled.
    expect(loadMemberstackMembers).toHaveBeenCalledTimes(1);
    expect(result.candidatesFound).toBe(3);
    expect(result.legacyPlansRemoved).toBe(2);
    expect(result.skippedNoUniqueMatch).toBe(1);
    expect(removeLegacyPlan).toHaveBeenCalledTimes(2);
    expect(removeLegacyPlan).toHaveBeenCalledWith("mem_a", LEGACY_ANNUAL_PLAN_ID);
    expect(removeLegacyPlan).toHaveBeenCalledWith("mem_b", LEGACY_ANNUAL_PLAN_ID);
  });

  it("treats an email shared by two Memberstack members as ambiguous", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "dup@x.com", subscriptionexpiring: "2026-07-27" },
      ]),
      loadMemberstackMembers: async () => ({
        members: [
          memberWithEmail("mem_1", "dup@x.com"),
          memberWithEmail("mem_2", "dup@x.com"),
        ],
        truncated: false,
      }),
      removeLegacyPlan,
    });

    expect(result.skippedNoUniqueMatch).toBe(1);
    expect(result.details[0]?.reason).toBe("ambiguous_memberstack_match");
    expect(result.legacyPlansRemoved).toBe(0);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("does not scan Memberstack when there are no resolvable candidates", async () => {
    const loadMemberstackMembers = vi.fn(async () => ({
      members: [] as MemberstackMember[],
      truncated: false,
    }));
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: false,
      queryFn: makeExpiredQueryFn([]),
      loadMemberstackMembers,
    });

    expect(loadMemberstackMembers).not.toHaveBeenCalled();
    expect(result.candidatesFound).toBe(0);
    expect(result.ok).toBe(true);
  });
});

describe("runLegacyAnnualExpiry - dry run", () => {
  it("reports would-remove without calling Memberstack", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      dryRun: true,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.dryRun).toBe(true);
    expect(result.legacyPlansRemoved).toBe(1);
    expect(result.details[0]?.reason).toBe("would_remove");
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });

  it("defaults to dry run when dryRun is not specified", async () => {
    const removeLegacyPlan = vi.fn(async () => {});
    const result = await runLegacyAnnualExpiry({
      now: NOW,
      queryFn: makeExpiredQueryFn([
        { memberid: "m1", email: "a@x.com", subscriptionexpiring: "2026-07-27" },
      ]),
      resolveMemberstackMemberByEmail: resolverFor({
        "a@x.com": { status: "unique", member: legacyOnlyMember },
      }),
      removeLegacyPlan,
    });

    expect(result.dryRun).toBe(true);
    expect(removeLegacyPlan).not.toHaveBeenCalled();
  });
});

describe("memberstack admin removePlan", () => {
  it("POSTs to /remove-plan with the plan id", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const client = createMemberstackAdminClient({
      secretKey: "sk_sb_test",
      fetchImpl,
    });
    await client.removePlan("mem_abc123", LEGACY_ANNUAL_PLAN_ID);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://admin.memberstack.com/members/mem_abc123/remove-plan",
    );
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      planId: LEGACY_ANNUAL_PLAN_ID,
    });
  });
});
