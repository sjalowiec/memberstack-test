import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  LEGACY_CREDIT_ENTRIES_LABEL,
  LEGACY_HOME_STUDY_COURSES_CSV,
  LEGACY_HOME_STUDY_COURSE_CATALOG,
  LEGACY_HOME_STUDY_SNAPSHOT,
  LIST_LEGACY_HOME_STUDY_PLANS_SQL,
  PLACEHOLDER_COURSE_IDS,
  UPSERT_LEGACY_HOME_STUDY_PLAN_SQL,
  filterPlanningCourses,
  mergePlanningCourses,
  parseLegacyHomeStudyCoursesCsv,
  planningCourses,
  saveLegacyHomeStudyCoursePlan,
  validateLegacyHomeStudyPlanWrite,
} from "./legacyHomeStudyCourses";

const csvPath = path.resolve("data/watson/legacy-home-study-courses.csv.txt");

const spotChecks: Record<
  number,
  {
    title: string;
    active: 0 | 1;
    courseCost: string;
    libraryEntries: number;
    creditEntries: number;
    subscriberFreeEntries: number;
  }
> = {
  7: {
    title: "Top Down Raglan Sweaters",
    active: 0,
    courseCost: "14.99",
    libraryEntries: 798,
    creditEntries: 783,
    subscriberFreeEntries: 15,
  },
  8: {
    title: "Beginner Bootcamp ",
    active: 1,
    courseCost: "49.95",
    libraryEntries: 474,
    creditEntries: 473,
    subscriberFreeEntries: 1,
  },
  11: {
    title: "Mile-a-Minute Hats",
    active: 0,
    courseCost: "9.99",
    libraryEntries: 4,
    creditEntries: 0,
    subscriberFreeEntries: 4,
  },
  16: {
    title: "Roll 'n Rib Slouchy Hat",
    active: 0,
    courseCost: "9.99",
    libraryEntries: 2,
    creditEntries: 0,
    subscriberFreeEntries: 2,
  },
  26: {
    title: "Ribber Basic Bootcamp",
    active: 0,
    courseCost: "49.95",
    libraryEntries: 226,
    creditEntries: 226,
    subscriberFreeEntries: 0,
  },
  27: {
    title: "Baby Boy Ear Flap Helmet",
    active: 0,
    courseCost: "14.99",
    libraryEntries: 24,
    creditEntries: 24,
    subscriberFreeEntries: 0,
  },
  49: {
    title: "Bonnie's One Piece Cocoon",
    active: 1,
    courseCost: "24.95",
    libraryEntries: 707,
    creditEntries: 2,
    subscriberFreeEntries: 705,
  },
  59: {
    title: "Shaped Crown Beanie",
    active: 0,
    courseCost: "9.99",
    libraryEntries: 0,
    creditEntries: 0,
    subscriberFreeEntries: 0,
  },
};

describe("legacy Home Study course catalog", () => {
  it("imports every row from the SQL export", () => {
    const fromDisk = fs.readFileSync(csvPath, "utf8");
    expect(LEGACY_HOME_STUDY_COURSES_CSV).toBe(fromDisk);
    expect(parseLegacyHomeStudyCoursesCsv(LEGACY_HOME_STUDY_COURSES_CSV)).toEqual(
      LEGACY_HOME_STUDY_COURSE_CATALOG,
    );
    expect(parseLegacyHomeStudyCoursesCsv(fromDisk)).toEqual(LEGACY_HOME_STUDY_COURSE_CATALOG);
    expect(LEGACY_HOME_STUDY_COURSE_CATALOG).toHaveLength(60);
    expect(LEGACY_HOME_STUDY_COURSE_CATALOG.map((course) => course.courseId)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
    expect(LEGACY_HOME_STUDY_SNAPSHOT.exportedOn).toBe("2026-09-23");
    expect(LEGACY_HOME_STUDY_SNAPSHOT.idSource).toBe("HomeStudy_courseid");
    expect(LEGACY_CREDIT_ENTRIES_LABEL).toBe("Legacy credit entries");
    expect(LEGACY_CREDIT_ENTRIES_LABEL).not.toMatch(/verified sales/i);
  });

  it("spot-checks HomeStudy course IDs from the export", () => {
    for (const [id, expected] of Object.entries(spotChecks)) {
      const course = LEGACY_HOME_STUDY_COURSE_CATALOG.find(
        (entry) => entry.courseId === Number(id),
      );
      expect(course).toMatchObject(expected);
    }
  });

  it("keeps placeholder rows in the source and out of the planning list", () => {
    expect(PLACEHOLDER_COURSE_IDS).toEqual([37, 56, 60]);
    expect(
      LEGACY_HOME_STUDY_COURSE_CATALOG.find((course) => course.courseId === 37)?.title,
    ).toBe("re-use this");
    expect(
      LEGACY_HOME_STUDY_COURSE_CATALOG.find((course) => course.courseId === 56)?.title,
    ).toBe("reuse this");
    expect(
      LEGACY_HOME_STUDY_COURSE_CATALOG.find((course) => course.courseId === 60)?.title,
    ).toBe("Slip");

    const listed = planningCourses();
    expect(listed).toHaveLength(57);
    const listedIds = listed.map((course) => course.courseId);
    expect(listedIds).not.toContain(37);
    expect(listedIds).not.toContain(56);
    expect(listedIds).not.toContain(60);
  });

  it("searches by title and course ID and sorts by legacy credit entries", () => {
    const listed = planningCourses();
    expect(filterPlanningCourses(listed, "bootcamp").map((course) => course.courseId)).toEqual([
      8, 26, 14,
    ]);
    expect(filterPlanningCourses(listed, "59").map((course) => course.courseId)).toEqual([59]);
    expect(filterPlanningCourses(listed, "Shaped Crown").map((course) => course.courseId)).toEqual([
      59,
    ]);
    expect(filterPlanningCourses(listed, "re-use")).toEqual([]);
    expect(filterPlanningCourses(listed, "Slip")).toEqual([]);

    const byCredit = filterPlanningCourses(listed, "");
    expect(byCredit[0]?.courseId).toBe(7);
    expect(byCredit[1]?.courseId).toBe(8);
    expect(byCredit[byCredit.length - 1]?.creditEntries).toBe(0);
  });
});

describe("legacy Home Study course plans", () => {
  it("rejects placeholder and unknown courses without writing", async () => {
    const queryFn = vi.fn();
    const placeholder = await saveLegacyHomeStudyCoursePlan(
      {
        courseId: "37",
        recreationStatus: "planned",
        otherUses: "Help Hub",
        privateNotes: "skip",
      },
      queryFn,
    );
    expect(placeholder).toEqual({
      ok: false,
      error: "Course 37 is a placeholder row and is not on the planning list.",
    });
    expect(queryFn).not.toHaveBeenCalled();

    const unknown = validateLegacyHomeStudyPlanWrite({
      courseId: "999",
      recreationStatus: "planned",
      otherUses: "",
      privateNotes: "",
    });
    expect(unknown.ok).toBe(false);
  });

  it("saves status and notes only to the planning table", async () => {
    const queryFn = vi.fn(async (_sql: string, params?: unknown[]) => [
      {
        course_id: params?.[0],
        recreation_status: params?.[1],
        other_uses: params?.[2],
        private_notes: params?.[3],
        updated_at: "2026-09-23T18:04:00.000Z",
      },
    ]);

    const result = await saveLegacyHomeStudyCoursePlan(
      {
        courseId: "59",
        recreationStatus: "considering",
        otherUses: "Possible Tip of the Week",
        privateNotes: "Ask Sue before recreating",
      },
      queryFn,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.courseId).toBe(59);
    expect(result.value.title).toBe("Shaped Crown Beanie");
    expect(result.value.recreationStatus).toBe("considering");
    expect(result.value.otherUses).toBe("Possible Tip of the Week");
    expect(result.value.privateNotes).toBe("Ask Sue before recreating");
    expect(result.value.updatedAtDisplay).toBeTruthy();
    expect(queryFn).toHaveBeenCalledWith(UPSERT_LEGACY_HOME_STUDY_PLAN_SQL, [
      59,
      "considering",
      "Possible Tip of the Week",
      "Ask Sue before recreating",
    ]);

    const sql = `${LIST_LEGACY_HOME_STUDY_PLANS_SQL}\n${UPSERT_LEGACY_HOME_STUDY_PLAN_SQL}`;
    expect(sql).toContain("watson_legacy_homestudy_course_plans");
    expect(sql).not.toMatch(/legacy_course_member_library/i);
    expect(sql).not.toMatch(/memberstack/i);
    expect(sql).not.toMatch(/ChallengesID/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  it("merges saved plans onto export facts without changing the counts", () => {
    const rows = mergePlanningCourses(filterPlanningCourses(planningCourses(), "49"), [
      {
        course_id: 49,
        recreation_status: "in_progress",
        other_uses: "Help Hub entry",
        private_notes: null,
        updated_at: "2026-09-23T18:04:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      courseId: 49,
      title: "Bonnie's One Piece Cocoon",
      creditEntries: 2,
      libraryEntries: 707,
      subscriberFreeEntries: 705,
      recreationStatus: "in_progress",
      otherUses: "Help Hub entry",
      privateNotes: "",
    });
  });
});
