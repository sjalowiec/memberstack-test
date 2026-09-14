import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_PLAN_ID,
  LEGACY_SK840_COURSE_SLUG,
  LEGACY_TH160_COURSE_PLAN_ID,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
} from "../../config/legacyCourseEntitlements";
import {
  MEMBERSHIPS,
  MEMBER_PLAN_IDS,
} from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
  ACCOUNT_OWNABLE_COURSES,
  accountOwnableCourseCatalogCards,
  ownedCourseSlugsFromMember,
  ownedCoursesForAccount,
  shouldShowAccountMyCourses,
} from "./accountMyCourses";

function payloadWithPlans(
  connections: Array<{ planId: string; status?: string; active?: boolean }>,
) {
  return {
    data: {
      id: "ms_member",
      auth: { email: "member@knititnow.com" },
      planConnections: connections.map((conn) => ({
        status: "ACTIVE",
        ...conn,
      })),
    },
  };
}

function payloadWithPlan(planId: string) {
  return payloadWithPlans([{ planId }]);
}

const catalogCards = accountOwnableCourseCatalogCards();
const course86 = catalogCards.find((card) => card.slug === KIN_TAITEXMA_160_COURSE_SLUG);
const course111 = catalogCards.find((card) => card.slug === LEGACY_SK840_COURSE_SLUG);

describe("account ownable catalog cards", () => {
  it("exposes browser-safe title, URL, and ownership plan IDs", () => {
    expect(ACCOUNT_OWNABLE_COURSES).toEqual([
      {
        courseId: 86,
        slug: KIN_TAITEXMA_160_COURSE_SLUG,
        title: "Taitexma TH/TR-160: Getting Started",
        href: "/courses/86",
        planIds: [
          COURSE_INDIVIDUAL_SALES.th160.legacyPlanId,
          COURSE_INDIVIDUAL_SALES.th160.paidPlanId,
        ],
      },
      {
        courseId: 111,
        slug: LEGACY_SK840_COURSE_SLUG,
        title: "Mastering the Silver Reed SK840",
        href: "/courses/111",
        planIds: [
          COURSE_INDIVIDUAL_SALES.sk840.legacyPlanId,
          COURSE_INDIVIDUAL_SALES.sk840.paidPlanId,
        ],
      },
    ]);
  });

  it("reuses existing catalog title and course URL", () => {
    expect(course86).toEqual({
      slug: KIN_TAITEXMA_160_COURSE_SLUG,
      title: "Taitexma TH/TR-160: Getting Started",
      href: "/courses/86",
    });
    expect(course111).toEqual({
      slug: LEGACY_SK840_COURSE_SLUG,
      title: "Mastering the Silver Reed SK840",
      href: "/courses/111",
    });
    expect(course86).not.toHaveProperty("thumbnail");
    expect(course86).not.toHaveProperty("description");
    expect(course111).not.toHaveProperty("thumbnail");
    expect(course111).not.toHaveProperty("description");
  });
});

describe("ownedCoursesForAccount", () => {
  it("TH160 Legacy displays Course 86", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlan(LEGACY_TH160_COURSE_PLAN_ID),
      catalogCards,
    );
    expect(ownedCourseSlugsFromMember(payloadWithPlan(LEGACY_TH160_COURSE_PLAN_ID))).toEqual([
      KIN_TAITEXMA_160_COURSE_SLUG,
    ]);
    expect(courses).toEqual([course86]);
    expect(shouldShowAccountMyCourses(courses)).toBe(true);
  });

  it("TH160 Paid displays Course 86", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlan(PAID_TH160_COURSE_PLAN_ID),
      catalogCards,
    );
    expect(courses.map((card) => card.slug)).toEqual([KIN_TAITEXMA_160_COURSE_SLUG]);
    expect(courses).toEqual([course86]);
  });

  it("SK840 Legacy displays Course 111", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlan(LEGACY_SK840_COURSE_PLAN_ID),
      catalogCards,
    );
    expect(courses).toEqual([course111]);
  });

  it("SK840 Paid displays Course 111", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlan(PAID_SK840_COURSE_PLAN_ID),
      catalogCards,
    );
    expect(courses.map((card) => card.slug)).toEqual([LEGACY_SK840_COURSE_SLUG]);
    expect(courses).toEqual([course111]);
  });

  it("a member owning both sees both", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlans([
        { planId: PAID_TH160_COURSE_PLAN_ID },
        { planId: LEGACY_SK840_COURSE_PLAN_ID },
      ]),
      catalogCards,
    );
    expect(courses.map((card) => card.slug)).toEqual([
      KIN_TAITEXMA_160_COURSE_SLUG,
      LEGACY_SK840_COURSE_SLUG,
    ]);
    expect(courses).toEqual([course86, course111]);
    expect(shouldShowAccountMyCourses(courses)).toBe(true);
  });

  it("a membership-only user does not see either as an owned course", () => {
    for (const planId of MEMBER_PLAN_IDS) {
      const courses = ownedCoursesForAccount(payloadWithPlan(planId), catalogCards);
      expect(courses).toEqual([]);
      expect(shouldShowAccountMyCourses(courses)).toBe(false);
    }

    const currentMembership = ownedCoursesForAccount(
      payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId),
      catalogCards,
    );
    expect(currentMembership).toEqual([]);
    expect(shouldShowAccountMyCourses(currentMembership)).toBe(false);
  });

  it("an unrelated plan does not display a course", () => {
    const courses = ownedCoursesForAccount(
      payloadWithPlan(PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId),
      catalogCards,
    );
    expect(courses).toEqual([]);
    expect(shouldShowAccountMyCourses(courses)).toBe(false);
  });

  it("duplicate qualifying plan connections do not create duplicate rows", () => {
    const duplicateSamePlan = ownedCoursesForAccount(
      payloadWithPlans([
        { planId: LEGACY_TH160_COURSE_PLAN_ID },
        { planId: LEGACY_TH160_COURSE_PLAN_ID },
      ]),
      catalogCards,
    );
    expect(duplicateSamePlan).toEqual([course86]);

    const legacyAndPaidSameCourse = ownedCoursesForAccount(
      payloadWithPlans([
        { planId: LEGACY_TH160_COURSE_PLAN_ID },
        { planId: PAID_TH160_COURSE_PLAN_ID },
        { planId: LEGACY_SK840_COURSE_PLAN_ID },
        { planId: PAID_SK840_COURSE_PLAN_ID },
      ]),
      catalogCards,
    );
    expect(legacyAndPaidSameCourse).toEqual([course86, course111]);
    expect(legacyAndPaidSameCourse).toHaveLength(2);
  });
});

describe("My Courses client/server boundary", () => {
  const serverOnlyImport = /from\s+["'][^"']*(?:coursesCatalog|courseContentAdmin|legacyCourseLoader|legacy_kin\/courseContentAdmin)["']|from\s+["'](?:node:fs|node:path|pg)["']/;

  it("keeps accountMyCourses free of server-only catalog loaders", () => {
    const source = readFileSync(resolve("src/lib/kinCourse/accountMyCourses.ts"), "utf8");
    expect(source).not.toMatch(serverOnlyImport);
    expect(source).not.toContain("getCourseCatalogEntries");
  });

  it("keeps the account My Courses script free of server-only catalog loaders", () => {
    const source = readFileSync(resolve("src/scripts/account-my-courses.ts"), "utf8");
    expect(source).not.toMatch(serverOnlyImport);
    expect(source).not.toContain("getCourseCatalogEntries");
  });
});
