import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { canAccessCourse } from "./courseAccess";
import {
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
} from "../config/legacyCourseEntitlements";
import { CURRENT_MEMBER_PLAN_IDS, LEGACY_PAID_MEMBER_PLAN_IDS, MEMBERSHIPS } from "../config/memberships";
import {
  KIN_COURSE_ACCESS_SESSION_KEY,
  KIN_TAITEXMA_160_COURSE_SLUG,
  writeConfirmedKinCourseAccess,
} from "./kinCourse/accessGateState";
import {
  KIN_COURSE_CACHE_ATTR,
  kinCourseCacheAccessInlineScript,
  kinCourseCacheAccessVars,
  kinCourseCacheUiFromInlineLogic,
  kinCourseCacheUiFromMember,
} from "./kinCourseCacheAccess";

const layoutSource = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
const gateSource = readFileSync(resolve("src/scripts/kinCourseAccessGate.ts"), "utf8");

function memberWithPlan(planId: string, status = "ACTIVE") {
  return {
    id: "ms_member",
    auth: { email: "member@knititnow.com" },
    planConnections: [{ planId, status }],
  };
}

type KinCourseCacheUiFromCase = "open" | "locked" | "unknown";

function runInlineScript(
  member: unknown,
  courseSlug = LEGACY_SK840_COURSE_SLUG,
  sessionRaw: string | null = null,
): string | null {
  const attrs: Record<string, string> = {};
  const sandbox = {
    localStorage: {
      getItem: (key: string) =>
        key === "_ms-mem" ? (member == null ? null : JSON.stringify(member)) : null,
    },
    sessionStorage: {
      getItem: (key: string) => (key === KIN_COURSE_ACCESS_SESSION_KEY ? sessionRaw : null),
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
      },
    },
  };
  vm.runInNewContext(kinCourseCacheAccessInlineScript(courseSlug), sandbox);
  return attrs[KIN_COURSE_CACHE_ATTR] ?? null;
}

describe("kinCourseCacheUiFromMember uses live course entitlement", () => {
  it("opens for Knit It Now membership and SK840-only, matching canAccessCourse", () => {
    const member = memberWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    const sk840 = memberWithPlan(LEGACY_SK840_COURSE_PLAN_ID);
    expect(canAccessCourse("member", member, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(
      true,
    );
    expect(canAccessCourse("member", sk840, { courseSlug: LEGACY_SK840_COURSE_SLUG })).toBe(true);
    expect(kinCourseCacheUiFromMember(member, LEGACY_SK840_COURSE_SLUG)).toBe("open");
    expect(kinCourseCacheUiFromMember(sk840, LEGACY_SK840_COURSE_SLUG)).toBe("open");
    expect(kinCourseCacheUiFromMember(member, KIN_TAITEXMA_160_COURSE_SLUG)).toBe("open");
    expect(kinCourseCacheUiFromMember(sk840, KIN_TAITEXMA_160_COURSE_SLUG)).toBe("unknown");
  });

  it("stays unknown without a cached member and does not treat unresolved plans as denied", () => {
    expect(kinCourseCacheUiFromMember(null, LEGACY_SK840_COURSE_SLUG)).toBe("unknown");
    expect(
      kinCourseCacheUiFromMember(
        { id: "ms_free", planConnections: [] },
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("unknown");
    expect(
      kinCourseCacheUiFromMember(
        { id: "ms_member", auth: { email: "member@knititnow.com" } },
        KIN_TAITEXMA_160_COURSE_SLUG,
      ),
    ).toBe("unknown");
    expect(
      kinCourseCacheUiFromMember(
        memberWithPlan(MEMBERSHIPS.beta.memberstackPlanId),
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("unknown");
    expect(
      kinCourseCacheUiFromMember(
        memberWithPlan(MEMBERSHIPS.membership.memberstackPlanId, "CANCELED"),
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("unknown");
  });
});

describe("inline cache script stays aligned with canAccessCourse", () => {
  it("embeds the live membership allow list, SK840 mapping, and session reuse key", () => {
    const paidPlanIds = [...CURRENT_MEMBER_PLAN_IDS, ...LEGACY_PAID_MEMBER_PLAN_IDS];
    const vars = kinCourseCacheAccessVars(LEGACY_SK840_COURSE_SLUG);
    expect(vars.planIds).toEqual(paidPlanIds);
    expect(vars.slugByPlan[LEGACY_SK840_COURSE_PLAN_ID]).toContain(LEGACY_SK840_COURSE_SLUG);
    const script = kinCourseCacheAccessInlineScript(LEGACY_SK840_COURSE_SLUG);
    for (const planId of paidPlanIds) {
      expect(script).toContain(planId);
    }
    expect(script).toContain(LEGACY_SK840_COURSE_PLAN_ID);
    expect(script).toContain(LEGACY_SK840_COURSE_SLUG);
    expect(script).toContain(KIN_COURSE_CACHE_ATTR);
    expect(script).toContain("_ms-mem");
    expect(script).toContain(KIN_COURSE_ACCESS_SESSION_KEY);
    expect(script).toContain("sessionStorage");
  });

  it("matches canAccessCourse for membership, SK840, unknown, and no-access caches", () => {
    const cases: Array<[unknown, KinCourseCacheUiFromCase]> = [
      [null, "unknown"],
      [memberWithPlan(MEMBERSHIPS.membership.memberstackPlanId), "open"],
      [memberWithPlan(LEGACY_SK840_COURSE_PLAN_ID), "open"],
      [{ id: "ms_free", planConnections: [] }, "unknown"],
      [memberWithPlan(MEMBERSHIPS.beta.memberstackPlanId), "unknown"],
    ];
    const vars = kinCourseCacheAccessVars(LEGACY_SK840_COURSE_SLUG);
    for (const [member, ui] of cases) {
      expect(kinCourseCacheUiFromMember(member, LEGACY_SK840_COURSE_SLUG)).toBe(ui);
      expect(kinCourseCacheUiFromInlineLogic(member, vars)).toBe(ui);
      expect(runInlineScript(member)).toBe(ui === "unknown" ? null : ui);
    }
  });

  it("reuses confirmed Course 86 and Course 111 access from sessionStorage", () => {
    const loadingMember = { id: "ms_member", auth: { email: "member@knititnow.com" } };
    const open86 = writeConfirmedKinCourseAccess(null, KIN_TAITEXMA_160_COURSE_SLUG, {
      memberId: "ms_member",
      unlocked: true,
    });
    const locked111 = writeConfirmedKinCourseAccess(null, LEGACY_SK840_COURSE_SLUG, {
      memberId: "ms_free",
      unlocked: false,
    });
    expect(runInlineScript(loadingMember, KIN_TAITEXMA_160_COURSE_SLUG, open86)).toBe("open");
    expect(
      runInlineScript({ id: "ms_free", planConnections: [] }, LEGACY_SK840_COURSE_SLUG, locked111),
    ).toBe("locked");
    expect(
      runInlineScript({ id: "ms_other", planConnections: [] }, KIN_TAITEXMA_160_COURSE_SLUG, open86),
    ).toBe(null);
  });
});

describe("KinCourseLayout cache-first paint", () => {
  it("runs the cache script before the Memberstack CDN and live gate still clears it", () => {
    expect(layoutSource).toContain("kinCourseCacheAccessInlineScript");
    expect(layoutSource).toContain("KIN_COURSE_CACHE_PAINT_CSS");
    const cssIdx = layoutSource.indexOf("KIN_COURSE_CACHE_PAINT_CSS");
    const scriptIdx = layoutSource.indexOf("kinCourseCacheAccessInlineScript");
    const cdnIdx = layoutSource.indexOf("static.memberstack.com/scripts/v2/memberstack.js");
    expect(cssIdx).toBeGreaterThan(-1);
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(scriptIdx).toBeLessThan(cdnIdx);
    expect(gateSource).toContain("clearKinCourseCachePaint");
    expect(gateSource).toContain("getAppAndMember");
  });
});
