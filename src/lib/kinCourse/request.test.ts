import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { loadKinCourseBundle } from "./load";
import { flattenLessons, getLessonContext } from "./player";
import { kinCourseHomeHref, kinCourseLessonHref } from "./hrefs";

const requireAdminForRequest = vi.hoisted(() => vi.fn());

vi.mock("../admin/requireAdminRequest", () => ({
  requireAdminForRequest,
}));

import { kinCourseLoadOptions, kinCoursePreviewRequested } from "./request";

const COURSE_86_ID = 86;
const COURSE_111_ID = 111;

const adminOk = {
  ok: true as const,
  member: { id: "mem_admin", email: "sue@knititnow.com" },
  mode: "verified" as const,
};

const unauthenticated = {
  ok: false as const,
  status: 401,
  error: "Sign in required.",
};

function requestFor(url: URL) {
  return new Request(url);
}

describe("numeric course admin preview", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
  });

  it("treats preview=true as requested on every host, including production", () => {
    expect(
      kinCoursePreviewRequested(new URL("https://www.knititnow.com/courses/86?preview=true")),
    ).toBe(true);
    expect(
      kinCoursePreviewRequested(new URL("https://kin-dev.netlify.app/courses/86?preview=true")),
    ).toBe(true);
    expect(kinCoursePreviewRequested(new URL("http://localhost:4321/courses/86"))).toBe(false);
  });

  it("loads unpublished Course 86 on production for an authenticated admin", async () => {
    requireAdminForRequest.mockResolvedValue(adminOk);
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(true);
    expect(options.includeDrafts).toBe(true);
    expect(requireAdminForRequest).toHaveBeenCalledTimes(1);

    const bundle = await loadKinCourseBundle(COURSE_86_ID, options);
    expect(bundle?.course.id).toBe(86);
    expect(kinCourseHomeHref(86, options.preview)).toBe("/courses/86?preview=true");
  });

  it("404s unpublished Course 86 on production when the visitor is not an admin", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).toBeNull();
  });

  it("404s unpublished Course 86 when a signed-in member is not on the admin allowlist", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).toBeNull();
  });

  it("404s unpublished Course 86 on DEV when the visitor is not an admin", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://kin-dev.netlify.app/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).toBeNull();

    const local = new URL("http://localhost:4321/courses/86?preview=true");
    const localOptions = await kinCourseLoadOptions(local, requestFor(local));
    expect(localOptions.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, localOptions)).toBeNull();
  });

  it("does not call admin auth when preview is not requested", async () => {
    const url = new URL("https://www.knititnow.com/courses/111");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(requireAdminForRequest).not.toHaveBeenCalled();
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
  });

  it("keeps published Course 111 working without preview or admin", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://www.knititnow.com/courses/111");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    const bundle = await loadKinCourseBundle(COURSE_111_ID, options);
    expect(bundle?.course.id).toBe(111);
    expect(flattenLessons(bundle!.course).length).toBeGreaterThan(10);
    expect(flattenLessons(bundle!.course).some((lesson) => lesson.id === 6171)).toBe(false);
  });

  it("ignores preview=true on published Course 111 for an unauthenticated visitor", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://www.knititnow.com/courses/111?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(false);
    const bundle = await loadKinCourseBundle(COURSE_111_ID, options);
    expect(bundle?.course.id).toBe(111);
    expect(flattenLessons(bundle!.course).some((lesson) => lesson.id === 6171)).toBe(false);
  });

  it("opens Course 86 home and every lesson under authenticated admin preview", async () => {
    requireAdminForRequest.mockResolvedValue(adminOk);
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    const bundle = await loadKinCourseBundle(COURSE_86_ID, options);
    expect(bundle).toBeTruthy();
    const lessons = flattenLessons(bundle!.course);
    expect(lessons.length).toBe(40);
    expect(findLessonIds(lessons)).toContain(4212);

    for (const lesson of lessons) {
      const context = getLessonContext(bundle!.course, lesson.id, true);
      expect(context?.lesson.id).toBe(lesson.id);
      expect(kinCourseLessonHref(86, lesson.id, true)).toBe(
        `/courses/86/lesson/${lesson.id}?preview=true`,
      );
    }
  });

  it("keeps Course 86 out of the public catalog", () => {
    const entries = getCourseCatalogEntries();
    expect(entries.some((course) => course.href === "/courses/86")).toBe(false);
    expect(entries.some((course) => course.slug.includes("taitexma"))).toBe(false);
  });

  it("reuses requireAdminForRequest and wires it through every numeric player page", () => {
    const requestSource = readFileSync(join(process.cwd(), "src/lib/kinCourse/request.ts"), "utf8");
    expect(requestSource).toContain("requireAdminForRequest");
    expect(requestSource).toContain('from "../admin/requireAdminRequest"');
    expect(requestSource).not.toContain("isCoursePreviewProductionBlocked");

    const pages = [
      "src/pages/courses/[courseSlug]/index.astro",
      "src/pages/courses/[courseSlug]/contents.astro",
      "src/pages/courses/[courseSlug]/complete.astro",
      "src/pages/courses/[courseSlug]/lesson/[assignId].astro",
    ];
    for (const page of pages) {
      const source = readFileSync(join(process.cwd(), page), "utf8");
      expect(source).toContain(
        "await kinCourseLoadOptions(Astro.url, Astro.request, Astro.cookies)",
      );
    }

    const layout = readFileSync(join(process.cwd(), "src/layouts/KinCourseLayout.astro"), "utf8");
    expect(layout).toContain("data-admin-preview={previewUnlock ? \"true\" : undefined}");
  });
});

function findLessonIds(lessons: Array<{ id: number }>): number[] {
  return lessons.map((lesson) => lesson.id);
}
