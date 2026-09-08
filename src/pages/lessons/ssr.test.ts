import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const slugSource = readFileSync(join(here, "[slug].astro"), "utf8");
const previewSource = readFileSync(join(here, "preview.astro"), "utf8");
const lessonPageSource = readFileSync(
  join(here, "..", "..", "components", "lessons", "LessonPage.astro"),
  "utf8",
);
const prepareSource = readFileSync(
  join(here, "..", "..", "lib", "lessons", "prepareLessonPage.ts"),
  "utf8",
);

describe("Member lesson public SSR", () => {
  it("server-renders published lessons from the database", () => {
    expect(slugSource).toContain("export const prerender = false");
    expect(slugSource).toContain("loadLessonBySlug");
    expect(slugSource).toContain("publicOnly: true");
    expect(slugSource).toContain("LessonPage");
    expect(slugSource).not.toMatch(/from ["'].*lessons\.json["']/);
  });

  it("renders authenticated preview with the same LessonPage implementation", () => {
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain("LessonPage");
    expect(previewSource).toContain("preview={true}");
    expect(previewSource).toContain("resolveLessonPreviewRecord");
    expect(previewSource).not.toContain("saveExistingLesson");
    expect(previewSource).not.toContain("saveNewLesson");
    expect(previewSource).not.toContain('searchParams.get("data")');
  });

  it("keeps the member-access gate on the public lesson page", () => {
    expect(lessonPageSource).toContain("requiresMemberAccess");
    expect(lessonPageSource).toContain("data-lesson-member-gate");
    expect(lessonPageSource).toContain("bootHelpHubMemberLessonGates");
    expect(lessonPageSource).toContain("documentBaseHref={previewDocumentBaseHref}");
    expect(prepareSource).toContain("lessonRequiresMemberAccess");
    expect(prepareSource).toContain('from "../lessonVideo"');
    expect(previewSource).toContain("preview: true");
  });
});
