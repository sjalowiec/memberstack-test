import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { flattenLessons } from "../kinCourse/player";
import { loadKinCourseBundle } from "../kinCourse/load";
import {
  getCourseContentPath,
  importPrivateCourseDraft,
  loadCourseContentDocument,
  publishCourseDraft,
  readCourseContentFile,
  saveCourseMetadata,
} from "./courseContentAdmin";
import {
  asPublishedSnapshot,
  courseHasKerchiefLesson,
  courseLessonsMatch,
  createPrivateCourseDocument,
  emptyCourseEditorialState,
  openingGifSrc,
  publishPreviewedCourseDraft,
  renderCourseDraftPreviewHtml,
  saveCourseDraft,
  studentCourseDocument,
  type CourseEditorialState,
} from "./courseEditorial";
import { isLegacyCoursePublic } from "./legacyCoursePublication";
import type { CoursePreviewData } from "./coursePreviewPoc";

function memoryEditorial() {
  const states = new Map<number, CourseEditorialState>();
  return {
    states,
    readEditorialState: async (courseId: number) => states.get(courseId) ?? null,
    writeEditorialState: async (courseId: number, state: CourseEditorialState) => {
      states.set(courseId, state);
    },
  };
}

describe("course editorial revisions", () => {
  it("starts a new course as a private draft", () => {
    const document = createPrivateCourseDocument({
      id: 400,
      title: "New course",
      slug: "new-course",
    });
    expect(document.course.status).toBe("draft");
    expect(document.course.published).toBe(false);
    expect(document.course.active).toBe(false);
    expect(document.lessons).toEqual([]);
    expect(isLegacyCoursePublic(document.course)).toBe(false);
  });

  it("keeps the published course when a draft is saved", () => {
    const bundled = readCourseContentFile(50);
    const published = structuredClone(bundled);
    published.course.title = "Student course";
    const first = saveCourseDraft(emptyCourseEditorialState(), published, "2026-01-01T00:00:00.000Z");
    const previewed = {
      ...first,
      previewedRevisionId: first.draft!.revisionId,
    };
    const publishedState = publishPreviewedCourseDraft(
      previewed,
      previewed.draft!.revisionId,
      "2026-01-01T00:00:01.000Z",
    );
    const edited = structuredClone(publishedState.draft!.document);
    edited.course.title = "Unpublished draft";
    edited.lessons[0]!.title = "Draft lesson";
    const saved = saveCourseDraft(publishedState, edited, "2026-01-02T00:00:00.000Z");

    expect(saved.published?.document.course.title).toBe("Student course");
    expect(saved.published?.document.lessons[0]?.title).not.toBe("Draft lesson");
    expect(saved.previewedRevisionId).toBeNull();
    expect(studentCourseDocument(saved, bundled)?.course.title).toBe("Student course");
  });

  it("publishes only the previewed revision and keeps its lessons", () => {
    const bundled = readCourseContentFile(50);
    const draft = structuredClone(bundled);
    draft.course.status = "draft";
    draft.course.published = false;
    draft.course.active = false;
    draft.lessons[0]!.title = "Previewed lesson";
    const saved = saveCourseDraft(emptyCourseEditorialState(), draft, "2026-01-01T00:00:00.000Z");
    expect(() =>
      publishPreviewedCourseDraft(saved, saved.draft!.revisionId, "2026-01-01T00:00:01.000Z"),
    ).toThrow(/Preview this draft/);

    const previewed = { ...saved, previewedRevisionId: saved.draft!.revisionId };
    const published = publishPreviewedCourseDraft(
      previewed,
      saved.draft!.revisionId,
      "2026-01-01T00:00:01.000Z",
    );
    expect(published.published?.sourceRevisionId).toBe(saved.draft!.revisionId);
    expect(courseLessonsMatch(published.published!.document, saved.draft!.document)).toBe(true);
    expect(published.published?.document.lessons[0]?.title).toBe("Previewed lesson");
    expect(isLegacyCoursePublic(published.published!.document.course)).toBe(true);
    expect(studentCourseDocument(published, bundled)?.lessons[0]?.title).toBe("Previewed lesson");
  });

  it("does not let a newer bundled copy replace a published revision", () => {
    const bundled = readCourseContentFile(66);
    const newerBundle = structuredClone(bundled);
    newerBundle.course.legacy = { ...newerBundle.course.legacy, contentRevision: 99 };
    newerBundle.course.title = "Older bundled copy";
    const snapshot = structuredClone(bundled);
    snapshot.course.title = "Published revision";
    const state: CourseEditorialState = {
      draft: null,
      previewedRevisionId: null,
      published: {
        revisionId: "published",
        sourceRevisionId: "previewed",
        savedAt: "2026-01-01T00:00:00.000Z",
        document: asPublishedSnapshot(snapshot),
      },
    };
    expect(studentCourseDocument(state, newerBundle)?.course.title).toBe("Published revision");
  });

  it("renders the thumbnail and opening gif in a draft preview", () => {
    const document = createPrivateCourseDocument({
      id: 66,
      title: "Ribber Basic Bootcamp",
      slug: "ribber-basic-bootcamp",
    });
    document.course.thumbnail = "/images/courses/ribber.webp";
    document.lessons = [
      {
        title: "Get Started",
        slug: "get-started",
        displayOrder: 1,
        legacy: { itemId: 1, lessonOrder: 1 },
        blocks: [
          {
            title: "Ready set go",
            slug: "ready-set-go",
            order: 1,
            legacy: { assignId: 1, blockType: "image" },
            components: [
              {
                type: "image",
                src: "/images/course-content/66/expert_beginner.gif",
                alt: "Opening",
                legacyComponentId: 1,
                order: 1,
              },
            ],
          },
        ],
      },
    ];
    const html = renderCourseDraftPreviewHtml(document);
    expect(openingGifSrc(document)).toBe("/images/course-content/66/expert_beginner.gif");
    expect(html).toContain('id="course-draft-thumbnail"');
    expect(html).toContain("/images/courses/ribber.webp");
    expect(html).toContain('id="course-draft-opening-gif"');
    expect(html).toContain("/images/course-content/66/expert_beginner.gif");
    expect(html).toContain("Students still see the published course");
  });
});

describe("course 66 draft migration", () => {
  it("imports a hosted copy as a private draft and leaves the bundled student course", async () => {
    const hosted = structuredClone(readCourseContentFile(66));
    hosted.course.title = "Hosted editor copy";
    hosted.lessons.push({
      title: "Knit a Double Pointed Kerchief/Scarf",
      slug: "knit-a-double-pointed-kerchief-scarf",
      displayOrder: 99,
      legacy: { itemId: 99, lessonOrder: 99 },
      blocks: [],
    });
    const imported = importPrivateCourseDraft(hosted, "2026-01-01T00:00:00.000Z");
    expect(imported.published).toBeNull();
    expect(imported.previewedRevisionId).toBeNull();
    expect(isLegacyCoursePublic(imported.draft!.document.course)).toBe(false);
    expect(courseHasKerchiefLesson(imported.draft!.document)).toBe(true);
    expect(imported.draft!.document.course.title).toBe("Hosted editor copy");

    const students = await loadKinCourseBundle(66, {
      readEditorialState: async () => imported,
    });
    const bundledStudents = await loadKinCourseBundle(66, {
      readEditorialState: async () => null,
    });
    expect(students?.course.title).toBe(bundledStudents?.course.title);
    expect(flattenLessons(students!.course).map((lesson) => lesson.id)).toEqual(
      flattenLessons(bundledStudents!.course).map((lesson) => lesson.id),
    );
  });

  it("does not write a bundled course over a saved draft", async () => {
    const writeEditorialState = vi.fn(async () => {});
    const bundled = structuredClone(readCourseContentFile(66));
    bundled.course.legacy = { ...bundled.course.legacy, contentRevision: 99 };
    const draft = importPrivateCourseDraft(readCourseContentFile(66), "2026-01-01T00:00:00.000Z");
    draft.draft!.document.course.title = "Saved draft";
    const loaded = await loadCourseContentDocument(66, {
      hostname: "knititnow.com",
      env: { isViteDev: false },
      readEditorialState: async () => draft,
      readCourseContentOverlay: async () => bundled,
      writeEditorialState,
    });
    expect(loaded.course.title).toBe("Saved draft");
    expect(writeEditorialState).not.toHaveBeenCalled();
  });

  it("saves course metadata to the draft and leaves the bundled file unchanged", async () => {
    const store = memoryEditorial();
    const before = readFileSync(getCourseContentPath(66), "utf8");
    const result = await saveCourseMetadata(
      66,
      { description: "Catalog blurb for admin save test." },
      { persist: "filesystem", ...store },
    );
    expect(result.description).toBe("Catalog blurb for admin save test.");
    expect(result.persistedVia).toBe("filesystem");
    expect(readFileSync(getCourseContentPath(66), "utf8")).toBe(before);
    expect(store.states.get(66)?.draft?.document.course.description).toBe(
      "Catalog blurb for admin save test.",
    );
    expect(store.states.get(66)?.published).toBeNull();
  });

  it("refuses to publish a revision that was not previewed", async () => {
    const store = memoryEditorial();
    const draft = importPrivateCourseDraft(readCourseContentFile(50), "2026-01-01T00:00:00.000Z");
    store.states.set(50, draft);
    await expect(
      publishCourseDraft(50, draft.draft!.revisionId, { persist: "filesystem", ...store }),
    ).rejects.toThrow(/Preview this draft/);
    expect(store.states.get(50)?.published).toBeNull();
  });
});
