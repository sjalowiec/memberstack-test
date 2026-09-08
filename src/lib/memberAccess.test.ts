import { afterEach, describe, expect, it } from "vitest";
import {
  FREE_ACCESS_MEMBERSHIPS,
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  MEMBERSHIP_PRICE_IDS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../config/memberships";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  resolveLegacyExpirationTiming,
} from "./membership/membershipStatusSummary";
import {
  clearRememberedLegacyPaidThroughForAccess,
  getViewerAccessState,
  hasFreeLegacyPlanConnection,
  hasMemberAccess,
  hasPaidMemberAccess,
  isLegacyPaidThroughCurrentlyValid,
  memberAccessCalendarYmdForNow,
  MEMBER_ACCESS_CALENDAR_TIMEZONE,
  needsLegacyPaidThroughForAccess,
  rememberLegacyPaidThroughForAccess,
} from "./memberAccess";
import { hasMemberAccessFromActivePlanIds } from "./patterns/patternBuilderAccess";
import { decidePatternMembershipGate } from "./patterns/patternMembershipPageGate";
import { canCreatePatternForSystem } from "./patterns/sleevelessPatternSystemAccess";

const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const MONTHLY_PRICE = MEMBERSHIP_PRICE_IDS.monthly;
const ANNUAL_PRICE = MEMBERSHIP_PRICE_IDS.annual;
const LEGACY_FREE = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const LEGACY_PAID_SHELL = LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId;
const BETA = MEMBERSHIPS.beta.memberstackPlanId;

/** Fixed "today" matching membership status / expiry calendar tests. */
const TODAY_YMD = "2026-07-22";
/** 2026-07-22 12:00 PDT — America/Los_Angeles calendar day 2026-07-22. */
const TODAY_NOON_PDT = new Date("2026-07-22T19:00:00.000Z");

function payload(options: {
  id?: string | null;
  planId?: string | null;
  status?: string;
  active?: boolean;
  priceId?: string;
  planConnections?: unknown[];
}) {
  const id = options.id === undefined ? "mem_test" : options.id;
  const connections =
    options.planConnections ??
    (options.planId
      ? [
          {
            planId: options.planId,
            status: options.status ?? "ACTIVE",
            active: options.active ?? true,
            payment: options.priceId ? { priceId: options.priceId } : undefined,
          },
        ]
      : []);
  return {
    data: {
      member: {
        ...(id ? { id } : {}),
        auth: { email: "member@example.com" },
        planConnections: connections,
      },
    },
  };
}

afterEach(() => {
  clearRememberedLegacyPaidThroughForAccess();
});

describe("hasMemberAccess — paid Memberstack memberships", () => {
  it("grants access for an active monthly Memberstack membership", () => {
    const res = payload({ planId: PAID, priceId: MONTHLY_PRICE });
    expect(hasPaidMemberAccess(res)).toBe(true);
    expect(hasMemberAccess(res)).toBe(true);
    expect(getViewerAccessState(res)).toBe("memberAccess");
    expect(needsLegacyPaidThroughForAccess(res)).toBe(false);
  });

  it("grants access for an active annual Memberstack membership", () => {
    const res = payload({ planId: PAID, priceId: ANNUAL_PRICE });
    expect(hasMemberAccess(res)).toBe(true);
    expect(getViewerAccessState(res)).toBe("memberAccess");
  });

  it("denies a canceled or expired Memberstack membership", () => {
    const canceled = payload({ planId: PAID, status: "CANCELED", active: false });
    const expired = payload({ planId: PAID, status: "EXPIRED", active: false });
    expect(hasMemberAccess(canceled)).toBe(false);
    expect(getViewerAccessState(canceled)).toBe("loggedInNoAccess");
    expect(hasMemberAccess(expired)).toBe(false);
    expect(getViewerAccessState(expired)).toBe("loggedInNoAccess");
  });

  it("grants access for retired paid legacy shells without a Watson date", () => {
    expect(hasMemberAccess(payload({ planId: LEGACY_PAID_SHELL }))).toBe(true);
    expect(
      hasMemberAccess(
        payload({ planId: LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId }),
      ),
    ).toBe(true);
  });
});

describe("hasMemberAccess — free legacy membership", () => {
  it("grants access for an active legacy membership with a future paid-through date", () => {
    const res = payload({ planId: LEGACY_FREE });
    expect(hasFreeLegacyPlanConnection(res)).toBe(true);
    expect(hasMemberAccess(res)).toBe(false);
    expect(
      hasMemberAccess(res, { legacyPaidThroughYmd: "2026-12-01", todayYmd: TODAY_YMD }),
    ).toBe(true);
    expect(
      getViewerAccessState(res, { legacyPaidThroughYmd: "2026-12-01", todayYmd: TODAY_YMD }),
    ).toBe("memberAccess");
  });

  it("denies an expired legacy membership even when the free plan is still connected", () => {
    const res = payload({ planId: LEGACY_FREE });
    expect(
      hasMemberAccess(res, { legacyPaidThroughYmd: "2026-07-21", todayYmd: TODAY_YMD }),
    ).toBe(false);
    expect(
      getViewerAccessState(res, { legacyPaidThroughYmd: "2026-07-21", todayYmd: TODAY_YMD }),
    ).toBe("loggedInNoAccess");
  });

  it("keeps access on the paid-through day itself (America/Los_Angeles calendar)", () => {
    const res = payload({ planId: LEGACY_FREE });
    expect(
      hasMemberAccess(res, {
        legacyPaidThroughYmd: TODAY_YMD,
        now: TODAY_NOON_PDT,
      }),
    ).toBe(true);
    expect(memberAccessCalendarYmdForNow(TODAY_NOON_PDT)).toBe(TODAY_YMD);
    expect(calendarYmdForNow(TODAY_NOON_PDT, MEMBERSHIP_STATUS_CALENDAR_TIMEZONE)).toBe(
      TODAY_YMD,
    );
    expect(MEMBER_ACCESS_CALENDAR_TIMEZONE).toBe(MEMBERSHIP_STATUS_CALENDAR_TIMEZONE);
    expect(resolveLegacyExpirationTiming(TODAY_YMD, TODAY_YMD)).toBe(
      "legacy_paid_through_future",
    );
    expect(isLegacyPaidThroughCurrentlyValid(TODAY_YMD, { todayYmd: TODAY_YMD })).toBe(true);
  });

  it("does not grant access from a free legacy plan alone (no paid-through date)", () => {
    const res = payload({ planId: LEGACY_FREE });
    expect(hasMemberAccess(res)).toBe(false);
    expect(hasMemberAccess(res, { legacyPaidThroughYmd: null, todayYmd: TODAY_YMD })).toBe(
      false,
    );
    expect(needsLegacyPaidThroughForAccess(res)).toBe(true);
  });

  it("grants access from a valid Watson date without the free legacy plan", () => {
    const noPlan = payload({ planId: null });
    expect(needsLegacyPaidThroughForAccess(noPlan)).toBe(true);
    expect(
      hasMemberAccess(noPlan, { legacyPaidThroughYmd: "2026-12-01", todayYmd: TODAY_YMD }),
    ).toBe(true);
    expect(
      getViewerAccessState(noPlan, {
        legacyPaidThroughYmd: "2026-12-01",
        todayYmd: TODAY_YMD,
      }),
    ).toBe("memberAccess");
  });

  it("denies an expired Watson date without the free legacy plan", () => {
    const noPlan = payload({ planId: null });
    expect(
      hasMemberAccess(noPlan, { legacyPaidThroughYmd: "2020-01-01", todayYmd: TODAY_YMD }),
    ).toBe(false);
    expect(
      getViewerAccessState(noPlan, {
        legacyPaidThroughYmd: "2020-01-01",
        todayYmd: TODAY_YMD,
      }),
    ).toBe("loggedInNoAccess");
  });

  it("paid membership still wins when a legacy date is expired", () => {
    const res = payload({
      planConnections: [
        { planId: LEGACY_FREE, status: "ACTIVE", active: true },
        { planId: PAID, status: "ACTIVE", active: true, payment: { priceId: MONTHLY_PRICE } },
      ],
    });
    expect(
      hasMemberAccess(res, { legacyPaidThroughYmd: "2020-01-01", todayYmd: TODAY_YMD }),
    ).toBe(true);
  });
});

describe("hasMemberAccess — visitors without membership", () => {
  it("denies a logged-in user with no qualifying membership", () => {
    const res = payload({ planId: null });
    expect(hasMemberAccess(res)).toBe(false);
    expect(getViewerAccessState(res)).toBe("loggedInNoAccess");
    expect(hasMemberAccess(payload({ planId: BETA }))).toBe(false);
    expect(hasMemberAccess(payload({ planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID }))).toBe(false);
  });

  it("denies a logged-out visitor", () => {
    expect(hasMemberAccess(null)).toBe(false);
    expect(getViewerAccessState(null)).toBe("loggedOut");
    expect(hasMemberAccess({ data: null })).toBe(false);
    expect(getViewerAccessState({ data: null })).toBe("loggedOut");
  });
});

describe("remembered legacy paid-through context", () => {
  it("lets sync gates reuse a loaded date for the same member", () => {
    const res = payload({ id: "mem_legacy", planId: LEGACY_FREE });
    rememberLegacyPaidThroughForAccess("mem_legacy", "2026-12-01");
    expect(hasMemberAccess(res, { todayYmd: TODAY_YMD })).toBe(true);
    rememberLegacyPaidThroughForAccess("mem_legacy", "2026-01-01");
    expect(hasMemberAccess(res, { todayYmd: TODAY_YMD })).toBe(false);
  });

  it("lets sync gates reuse a loaded date for a member without the free plan", () => {
    const res = payload({ id: "mem_migrated", planId: null });
    rememberLegacyPaidThroughForAccess("mem_migrated", "2026-12-01");
    expect(hasMemberAccess(res, { todayYmd: TODAY_YMD })).toBe(true);
    rememberLegacyPaidThroughForAccess("mem_migrated", "2026-01-01");
    expect(hasMemberAccess(res, { todayYmd: TODAY_YMD })).toBe(false);
  });

  it("does not apply another member's remembered date", () => {
    const res = payload({ id: "mem_a", planId: LEGACY_FREE });
    rememberLegacyPaidThroughForAccess("mem_b", "2026-12-01");
    expect(hasMemberAccess(res, { todayYmd: TODAY_YMD })).toBe(false);
  });
});

describe("expired legacy member cannot use member-only surfaces", () => {
  const expired = {
    legacyPaidThroughYmd: "2026-07-01",
    todayYmd: TODAY_YMD,
  };

  it("cannot open member-only content", () => {
    const res = payload({ planId: LEGACY_FREE });
    expect(hasMemberAccess(res, expired)).toBe(false);
    expect(getViewerAccessState(res, expired)).toBe("loggedInNoAccess");
  });

  it("cannot open a Pattern Builder or create/edit a pattern", () => {
    const access = {
      loggedIn: true,
      memberId: "mem_legacy",
      activePlanIds: [] as string[],
      hasSystemAccess: false,
      freeClaimsBySystem: {},
      legacyPaidThroughYmd: expired.legacyPaidThroughYmd,
    };
    expect(hasMemberAccessFromActivePlanIds([], expired)).toBe(false);
    expect(hasMemberAccessFromActivePlanIds([LEGACY_FREE], expired)).toBe(false);
    expect(canCreatePatternForSystem(access, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(access, "drop-shoulder")).toBe(false);
    expect(decidePatternMembershipGate(access).state).toBe("locked-no-access");
  });

  it("does not unlock from a direct membership check with only the plan id", () => {
    expect(hasMemberAccess(payload({ planId: LEGACY_FREE }))).toBe(false);
    expect(hasMemberAccessFromActivePlanIds([LEGACY_FREE])).toBe(false);
  });
});

describe("corrected legacy access matrix", () => {
  const future = { legacyPaidThroughYmd: "2026-10-07", todayYmd: TODAY_YMD };
  const today = { legacyPaidThroughYmd: TODAY_YMD, todayYmd: TODAY_YMD };
  const expiredDate = { legacyPaidThroughYmd: "2026-07-01", todayYmd: TODAY_YMD };
  const noPlan = payload({ planId: null });
  const withFreePlan = payload({ planId: LEGACY_FREE });

  it("1–2. active paid monthly and annual plans grant access without Watson", () => {
    expect(hasMemberAccess(payload({ planId: PAID, priceId: MONTHLY_PRICE }))).toBe(true);
    expect(hasMemberAccess(payload({ planId: PAID, priceId: ANNUAL_PRICE }))).toBe(true);
    expect(needsLegacyPaidThroughForAccess(payload({ planId: PAID }))).toBe(false);
  });

  it("3. valid Watson date with the free legacy plan grants access", () => {
    expect(hasMemberAccess(withFreePlan, future)).toBe(true);
  });

  it("4. valid Watson date without the free legacy plan grants access", () => {
    expect(hasMemberAccess(noPlan, future)).toBe(true);
    expect(hasMemberAccessFromActivePlanIds([], future)).toBe(true);
    const access = {
      loggedIn: true,
      memberId: "mem_migrated",
      activePlanIds: [] as string[],
      hasSystemAccess: false,
      freeClaimsBySystem: {},
      legacyPaidThroughYmd: future.legacyPaidThroughYmd,
    };
    expect(canCreatePatternForSystem(access, "sleeveless")).toBe(true);
    expect(
      decidePatternMembershipGate({
        ...access,
        hasSystemAccess: true,
      }).state,
    ).toBe("member");
  });

  it("5. a Watson date expiring today still grants access", () => {
    expect(hasMemberAccess(noPlan, today)).toBe(true);
    expect(hasMemberAccess(withFreePlan, today)).toBe(true);
  });

  it("6–7. expired Watson dates deny access with or without the free plan", () => {
    expect(hasMemberAccess(withFreePlan, expiredDate)).toBe(false);
    expect(hasMemberAccess(noPlan, expiredDate)).toBe(false);
  });

  it("8. a free legacy plan with no Watson expiration denies access", () => {
    expect(hasMemberAccess(withFreePlan, { legacyPaidThroughYmd: null, todayYmd: TODAY_YMD })).toBe(
      false,
    );
  });

  it("9. no paid plan and no Watson record denies access", () => {
    expect(hasMemberAccess(noPlan)).toBe(false);
    expect(hasMemberAccess(noPlan, { legacyPaidThroughYmd: null, todayYmd: TODAY_YMD })).toBe(
      false,
    );
  });

  it("10. missing or failed Watson expiration data denies access", () => {
    expect(hasMemberAccess(noPlan, { legacyPaidThroughYmd: null, todayYmd: TODAY_YMD })).toBe(
      false,
    );
    expect(hasMemberAccess(withFreePlan, { legacyPaidThroughYmd: null, todayYmd: TODAY_YMD })).toBe(
      false,
    );
  });

  it("11. an active paid plan still grants access when Watson is expired", () => {
    expect(
      hasMemberAccess(payload({ planId: PAID, priceId: MONTHLY_PRICE }), expiredDate),
    ).toBe(true);
  });
});
