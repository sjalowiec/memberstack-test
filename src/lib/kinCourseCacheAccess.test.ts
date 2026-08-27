import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { canAccessCourse } from "./courseAccess";
import {
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
} from "../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS, MEMBERSHIPS } from "../config/memberships";
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

function runInlineScript(member: unknown, courseSlug = LEGACY_SK840_COURSE_SLUG): string | null {
  const attrs: Record<string, string> = {};
  const sandbox = {
    localStorage: {
      getItem: (key: string) =>
        key === "_ms-mem" ? (member == null ? null : JSON.stringify(member)) : null,
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
  });

  it("stays unknown without a cached member and locked without a course plan", () => {
    expect(kinCourseCacheUiFromMember(null, LEGACY_SK840_COURSE_SLUG)).toBe("unknown");
    expect(
      kinCourseCacheUiFromMember(
        { id: "ms_free", planConnections: [] },
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("locked");
    expect(
      kinCourseCacheUiFromMember(
        memberWithPlan(MEMBERSHIPS.beta.memberstackPlanId),
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("locked");
    expect(
      kinCourseCacheUiFromMember(
        memberWithPlan(MEMBERSHIPS.membership.memberstackPlanId, "CANCELED"),
        LEGACY_SK840_COURSE_SLUG,
      ),
    ).toBe("locked");
  });
});

describe("inline cache script stays aligned with canAccessCourse", () => {
  it("embeds the live membership allow list and SK840 mapping", () => {
    const vars = kinCourseCacheAccessVars(LEGACY_SK840_COURSE_SLUG);
    expect(vars.planIds).toEqual([...COURSE_ACCESS_PLAN_IDS]);
    expect(vars.slugByPlan[LEGACY_SK840_COURSE_PLAN_ID]).toContain(LEGACY_SK840_COURSE_SLUG);
    const script = kinCourseCacheAccessInlineScript(LEGACY_SK840_COURSE_SLUG);
    for (const planId of COURSE_ACCESS_PLAN_IDS) {
      expect(script).toContain(planId);
    }
    expect(script).toContain(LEGACY_SK840_COURSE_PLAN_ID);
    expect(script).toContain(LEGACY_SK840_COURSE_SLUG);
    expect(script).toContain(KIN_COURSE_CACHE_ATTR);
    expect(script).toContain("_ms-mem");
  });

  it("matches canAccessCourse for membership, SK840, unknown, and no-access caches", () => {
    const cases: Array<[unknown, KinCourseCacheUiFromCase]> = [
      [null, "unknown"],
      [memberWithPlan(MEMBERSHIPS.membership.memberstackPlanId), "open"],
      [memberWithPlan(LEGACY_SK840_COURSE_PLAN_ID), "open"],
      [{ id: "ms_free", planConnections: [] }, "locked"],
      [memberWithPlan(MEMBERSHIPS.beta.memberstackPlanId), "locked"],
    ];
    const vars = kinCourseCacheAccessVars(LEGACY_SK840_COURSE_SLUG);
    for (const [member, ui] of cases) {
      expect(kinCourseCacheUiFromMember(member, LEGACY_SK840_COURSE_SLUG)).toBe(ui);
      expect(kinCourseCacheUiFromInlineLogic(member, vars)).toBe(ui);
      expect(runInlineScript(member)).toBe(ui === "unknown" ? null : ui);
    }
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
