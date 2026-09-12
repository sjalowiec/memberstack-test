import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { loadKinCourseBundle } from "./load";
import { flattenLessons, getLessonContext } from "./player";
import { kinCourseHomeHref, kinCourseLessonHref } from "./hrefs";

const requireAdminForRequest = vi.hoisted(() => vi.fn());

vi.mock("../admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../admin/requireAdminRequest")>();
  return {
    ...actual,
    requireAdminForRequest,
  };
});

import {
  kinCourseLoadOptions,
  kinCourseNeedsAdminPreviewBootstrap,
  kinCoursePreviewRequested,
} from "./request";
import { createKinAdminPreviewGrant } from "./adminPreviewGrant";
import { looksLikeJwt } from "../admin/requireAdminRequest";

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
    delete process.env.MEMBERSTACK_SECRET_KEY;
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

  it("still loads Course 86 on production for an authenticated admin preview", async () => {
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

  it("loads Course 86 on production without admin preview (temporary QA)", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();
  });

  it("loads Course 86 when a signed-in member is not on the admin allowlist (temporary QA)", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();
  });

  it("loads Course 86 on DEV without admin preview (temporary QA)", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://kin-dev.netlify.app/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url));
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();

    const local = new URL("http://localhost:4321/courses/86?preview=true");
    const localOptions = await kinCourseLoadOptions(local, requestFor(local));
    expect(localOptions.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, localOptions)).not.toBeNull();
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

  it("does not grant preview from a browser GET that has no bearer token", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url), {
      get: () => undefined,
    });
    expect(options.preview).toBe(false);
    expect(options.includeDrafts).toBe(false);
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();
    expect(kinCourseNeedsAdminPreviewBootstrap(true, null)).toBe(true);
  });

  it("sets an httpOnly signed grant cookie after verified admin fetch, not a Memberstack JWT", async () => {
    process.env.MEMBERSTACK_SECRET_KEY = "test-admin-preview-secret";
    requireAdminForRequest.mockResolvedValue(adminOk);
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW0ifQ.signature-value";
    const set = vi.fn();
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(
      url,
      new Request(url, { headers: { Authorization: `Bearer ${jwt}` } }),
      { get: () => undefined, set },
    );
    expect(options.preview).toBe(true);
    expect(set).toHaveBeenCalledWith(
      "kin_admin_preview",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/courses",
        secure: true,
        maxAge: 15 * 60,
      }),
    );
    const cookieValue = set.mock.calls[0]?.[1] as string;
    expect(cookieValue).not.toBe(jwt);
    expect(looksLikeJwt(cookieValue)).toBe(false);
  });

  it("grants later GETs from a valid signed preview cookie without a Memberstack JWT", async () => {
    process.env.MEMBERSTACK_SECRET_KEY = "test-admin-preview-secret";
    const grant = createKinAdminPreviewGrant("mem_admin", {
      env: { MEMBERSTACK_SECRET_KEY: "test-admin-preview-secret" },
    });
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url), {
      get: (name) => (name === "kin_admin_preview" ? { value: grant! } : undefined),
    });
    expect(options.preview).toBe(true);
    expect(requireAdminForRequest).not.toHaveBeenCalled();
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();
  });

  it("does not persist a preview cookie when admin auth fails", async () => {
    requireAdminForRequest.mockResolvedValue(unauthenticated);
    const set = vi.fn();
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    await kinCourseLoadOptions(url, requestFor(url), { get: () => undefined, set });
    expect(set).not.toHaveBeenCalled();
  });

  it("does not persist a preview cookie for a signed-in non-admin", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const set = vi.fn();
    const url = new URL("https://www.knititnow.com/courses/86?preview=true");
    const options = await kinCourseLoadOptions(url, requestFor(url), { get: () => undefined, set });
    expect(options.preview).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(await loadKinCourseBundle(COURSE_86_ID, options)).not.toBeNull();
  });

  it("reuses requireAdminForRequest and wires it through every numeric player page", () => {
    const requestSource = readFileSync(join(process.cwd(), "src/lib/kinCourse/request.ts"), "utf8");
    expect(requestSource).toContain("requireAdminForRequest");
    expect(requestSource).toContain('from "../admin/requireAdminRequest"');
    expect(requestSource).toContain("persistKinCourseAdminPreviewCookie");
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
      expect(source).toContain("KinCourseAdminPreviewBootstrap");
      expect(source).toContain("kinCourseNeedsAdminPreviewBootstrap");
    }

    const bootstrap = readFileSync(
      join(process.cwd(), "src/components/kinCourse/KinCourseAdminPreviewBootstrap.astro"),
      "utf8",
    );
    expect(bootstrap).toContain("data-kin-admin-preview-bootstrap");
    expect(bootstrap).toContain("runKinCourseAdminPreviewBootstrap");
    expect(bootstrap).toContain("Course not found");

    const client = readFileSync(join(process.cwd(), "src/scripts/kinCourseAdminPreview.ts"), "utf8");
    expect(client).toContain("fetchAdminHtml");
    expect(client).toContain('method: "GET"');

    const authClient = readFileSync(join(process.cwd(), "src/lib/admin/adminAuthClient.ts"), "utf8");
    expect(authClient).toContain("getMemberCookie");
    expect(authClient).toContain("fetchAdminHtml");

    const requireAdmin = readFileSync(
      join(process.cwd(), "src/lib/admin/requireAdminRequest.ts"),
      "utf8",
    );
    expect(requireAdmin).toContain("import.meta.env.ADMIN_MEMBER_IDS");
    expect(requireAdmin).toContain("import.meta.env.ADMIN_MEMBER_EMAILS");
    expect(requireAdmin).toContain("astroServerAdminEnv");

    const layout = readFileSync(join(process.cwd(), "src/layouts/KinCourseLayout.astro"), "utf8");
    expect(layout).toContain("data-admin-preview={previewUnlock ? \"true\" : undefined}");
  });
});

function findLessonIds(lessons: Array<{ id: number }>): number[] {
  return lessons.map((lesson) => lesson.id);
}
