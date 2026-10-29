import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  COURSE_INDIVIDUAL_SALES,
  LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
  LEGACY_COURSE_PLAN_SLUGS,
} from "../../config/legacyCourseEntitlements";
import {
  canAccessCourse,
  hasCourseMembershipAccess,
  hasIndividualCoursePurchase,
} from "../courseAccess";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { courseCheckoutPriceId } from "./coursePurchase";
import { ownedCoursesForAccount } from "./accountMyCourses";
import course33 from "../../data/legacy_kin/cleaned/course_33_beginner_workshop.poc.json";

const otherSlugs = [
  "taitexma-th-tr-160-getting-started",
  "mastering-the-silver-reed-sk840",
  "brother-kh-kr-260-quick-start",
  "master-lk-patterning",
  "lk-150-quick-start",
  "lk-150-fun",
] as const;

function payloadWithPlan(planId: string, status = "ACTIVE") {
  return {
    data: {
      id: "ms_member",
      auth: { email: "owner@example.com" },
      planConnections: [{ planId, status }],
    },
  };
}

describe("published Beginner Workshop", () => {
  const data = course33 as {
    course: { legacyChallengeId: number; slug: string; status: string; published: boolean; active: boolean };
    lessons: Array<{ title: string; displayOrder: number; blocks: Array<{ legacy?: { assignId?: number }; title?: string }> }>;
  };

  it("publishes the approved 15 lessons and 28 sections at course 33", () => {
    expect(data.course.legacyChallengeId).toBe(33);
    expect(data.course.slug).toBe("beginner-workshop");
    expect(data.course.status).toBe("published");
    expect(data.course.published).toBe(true);
    expect(data.course.active).toBe(true);
    expect(data.lessons).toHaveLength(15);
    expect(data.lessons.reduce((count, lesson) => count + lesson.blocks.length, 0)).toBe(28);
    expect(data.lessons.map((lesson) => lesson.displayOrder)).toEqual([
      1, 2, 3, 4, 5, 7, 9, 10, 12, 20, 30, 40, 50, 60, 70,
    ]);
    const ids = data.lessons.flatMap((lesson) =>
      lesson.blocks.map((block) => block.legacy?.assignId),
    );
    expect(ids).toContain(1078);
    expect(ids).toContain(1079);
    expect(ids).toContain(3314);
    const hat = JSON.stringify(data.lessons.find((lesson) => lesson.title === "Project: Let's Knit a Hat!"));
    expect(hat).toContain("/images/course-content/33/hat-builder.png");
    expect(hat).toContain('href=\\"/patterns/hat/builder?new=1\\"');
    expect(hat).toContain('target=\\"_blank\\"');
    const raw = JSON.stringify(data);
    expect(raw).toContain("/downloads/beginner_worksheets.pdf");
    expect(raw).toContain("/downloads/Machine_Knitting_Abbreviations.pdf");
    for (const name of ["0", "1", "2", "3", "4", "5", "6"]) {
      const path =
        name === "0"
          ? "public/images/tools/yarn_standards/0.png"
          : `public/images/glossary/${name}.png`;
      expect(existsSync(resolve(path))).toBe(true);
    }
  });

  it("lets members and the legacy plan in, and does not sell the course", () => {
    expect(LEGACY_COURSE_PLAN_SLUGS[LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID]).toEqual([
      BEGINNER_WORKSHOP_COURSE_SLUG,
    ]);
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.paidPlanId).toBeUndefined();
    expect(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.priceId).toBeUndefined();
    expect(courseCheckoutPriceId(BEGINNER_WORKSHOP_COURSE_SLUG)).toBeNull();
    expect(courseCheckoutPriceId("33")).toBeNull();

    const member = payloadWithPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasCourseMembershipAccess(member)).toBe(true);
    expect(canAccessCourse("member", member, { courseSlug: BEGINNER_WORKSHOP_COURSE_SLUG })).toBe(
      true,
    );

    const owner = payloadWithPlan(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID);
    expect(hasIndividualCoursePurchase(BEGINNER_WORKSHOP_COURSE_SLUG, owner)).toBe(true);
    expect(canAccessCourse("member", owner, { courseSlug: "33" })).toBe(true);
    expect(hasCourseMembershipAccess(owner)).toBe(false);
    for (const slug of otherSlugs) {
      expect(hasIndividualCoursePurchase(slug, owner)).toBe(false);
      expect(canAccessCourse("member", owner, { courseSlug: slug })).toBe(false);
    }
    expect(ownedCoursesForAccount(owner)).toEqual([
      { slug: BEGINNER_WORKSHOP_COURSE_SLUG, title: "Beginner Workshop", href: "/courses/33" },
    ]);
    expect(
      ownedCoursesForAccount(payloadWithPlan(LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID, "CANCELED")),
    ).toEqual([]);

    const catalog = getCourseCatalogEntries({ hostname: "knititnow.com" }).find(
      (course) => course.slug === BEGINNER_WORKSHOP_COURSE_SLUG,
    );
    expect(catalog).toMatchObject({
      title: "Beginner Workshop",
      category: "Getting Started",
      status: "available",
      access: "member",
      href: "/courses/beginner-workshop",
      description: "A guided start-to-finish path for new machine knitters.",
      thumbnail: "/images/courses/beginner.webp",
      buttonLabel: "View Course",
    });
  });
});
