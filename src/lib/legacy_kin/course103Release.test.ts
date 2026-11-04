import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { LEGACY_COURSE_PLAN_SLUGS } from "../../config/legacyCourseEntitlements";
import { canAccessCourse } from "../courseAccess";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { getCourseAccessBySlug } from "../coursesCatalogAccess";
import { isLegacyCoursePublic } from "./legacyCoursePublication";
import course103 from "../../data/legacy_kin/cleaned/course_103_ultimate_brother_930_940_workshop.poc.json";

const SLUG = "ultimate-brother-930-940-workshop";
const DAISY_ARCHIVE =
  "https://web.archive.org/web/20190418202159/http://www.daisyknits.com/bcompatibility.htm";

function block(assignId: number) {
  for (const lesson of course103.lessons) {
    for (const item of lesson.blocks) {
      if (item.legacy?.assignId === assignId) return item;
    }
  }
  return null;
}

describe("published Brother 930/940 workshop", () => {
  const raw = JSON.stringify(course103);

  it("publishes the Watson draft for members and keeps the Daisy archive link", () => {
    expect(course103.course.legacyChallengeId).toBe(103);
    expect(course103.course.slug).toBe(SLUG);
    expect(course103.course.status).toBe("published");
    expect(course103.course.published).toBe(true);
    expect(course103.course.active).toBe(true);
    expect(course103.course.contentStatus).toBe("cleaned");
    expect(isLegacyCoursePublic(course103.course)).toBe(true);
    expect(raw).toContain(DAISY_ARCHIVE);
    expect(raw).not.toContain("brother-kh930-kh940-accessory-compatibility");
    expect(raw).toContain("Watch the video");
    expect(raw).toContain("1046394794");
    expect(raw).toContain("742452827");
    expect(Object.values(LEGACY_COURSE_PLAN_SLUGS).some((slugs) => slugs.includes(SLUG))).toBe(
      false,
    );
  });

  it("ships the lesson photos and downloads at the URLs the draft uses", () => {
    const urls = [
      "/images/course-content/103/knitweave.jpg",
      "/images/course-content/103/long-stitch1.jpg",
      "/images/course-content/103/long-stitch2.jpg",
      "/images/course-content/103/long-stitch3.jpg",
      "/images/course-content/103/long-stitch4.jpg",
      "/images/course-content/103/long-stitch5.jpg",
      "/images/course-content/103/long_stitch_thumb.png",
      "/images/course-content/103/panel1.jpg",
      "/v2/103/setup1.jpg",
      "/v2/103/setup2.jpg",
      "/v2/103/setup3.jpg",
      "/v2/103/setup4.jpg",
      "/v2/103/setup5.jpg",
      "/v2/103/setup6.jpg",
      "/v2/103/setup81.jpg",
      "/v2/103/setup9.jpg",
      "/downloads/940_reference_card.pdf",
    ];
    for (const url of urls) {
      expect(raw).toContain(url);
      expect(existsSync(resolve("public" + url))).toBe(true);
    }
    const electronics = JSON.stringify(block(5864));
    const ribber = JSON.stringify(block(5913));
    expect(electronics).not.toContain("SECONDDIV");
    expect(electronics).toContain("7.007007007007007%");
    expect(ribber).not.toContain("SECONDDIV");
  });

  it("opens for members and stays closed without a membership", () => {
    const member = {
      data: {
        id: "ms_member",
        planConnections: [{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }],
      },
    };
    const loggedOut = { data: { member: null } };
    expect(getCourseAccessBySlug(SLUG)).toBe("member");
    expect(canAccessCourse("member", member, { courseSlug: SLUG })).toBe(true);
    expect(canAccessCourse("member", loggedOut, { courseSlug: SLUG })).toBe(false);
    expect(getCourseCatalogEntries({ hostname: "knititnow.com" })).toContainEqual(
      expect.objectContaining({
        slug: SLUG,
        href: "/courses/103",
        access: "member",
        status: "available",
      }),
    );
  });
});
