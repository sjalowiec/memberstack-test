import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import helpHubData from "../data/help-hub.json";
import lessonsData from "../data/lessons.json";
import { lessonRequiresMemberAccess } from "./helpHubMemberLesson";
import {
  LESSON_MEMBER_BODY_MOUNT_ATTR,
  LESSON_MEMBER_BODY_ROOT_ATTR,
  LESSON_MEMBER_BODY_TEMPLATE_ATTR,
  lessonBodyUsesDeferredTemplate,
  lessonProtectedSectionLabels,
} from "./lessonMemberBodyGate";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const lessons = Array.isArray(lessonsData) ? lessonsData : [];
const helpHubTips = Array.isArray(helpHubData) ? helpHubData : [];

const tuckLesson = lessons.find((l) => l.slug === "tuck-on-the-lk150");
const lessonPageSource = readFileSync(
  join(repoRoot, "src", "pages", "lessons", "[slug].astro"),
  "utf8",
);
const instructionalBodySource = readFileSync(
  join(repoRoot, "src", "components", "lessons", "LessonInstructionalBody.astro"),
  "utf8",
);

describe("lessonProtectedSectionLabels", () => {
  it("captures tuck-on-the-lk150 protected section titles", () => {
    expect(tuckLesson).toBeTruthy();
    expect(lessonProtectedSectionLabels(tuckLesson!)).toEqual([
      "About Tuck",
      "Cheat Sheets for Selecting Needles",
      "Printable Technique Reference Cards",
    ]);
  });
});

describe("lesson body gate markup contract", () => {
  it("requires member-gated lessons to defer instructional markup in a template", () => {
    expect(lessonRequiresMemberAccess(tuckLesson!, helpHubTips, lessons)).toBe(true);
    expect(lessonBodyUsesDeferredTemplate(true)).toBe(true);

    expect(lessonPageSource).toContain(LESSON_MEMBER_BODY_TEMPLATE_ATTR);
    expect(lessonPageSource).toContain(LESSON_MEMBER_BODY_MOUNT_ATTR);
    expect(lessonPageSource).toContain("LessonInstructionalBody");
    expect(lessonPageSource).toMatch(
      /requiresMemberAccess\s*\?\s*\([\s\S]*template[\s\S]*LessonInstructionalBody/,
    );
  });

  it("keeps tuck protected sections inside the shared instructional body component only", () => {
    const labels = lessonProtectedSectionLabels(tuckLesson!);
    expect(labels).toContain("About Tuck");
    expect(labels).toContain("Cheat Sheets for Selecting Needles");

    expect(instructionalBodySource).toContain("lesson-body-blocks");
    expect(instructionalBodySource).toContain("lesson-video-block__label");
    expect(instructionalBodySource).toContain(LESSON_MEMBER_BODY_ROOT_ATTR);

    const lessonPageMarkup = lessonPageSource.split("</Layout>")[0] ?? "";
    expect(lessonPageMarkup).not.toMatch(/<div class="lesson-body-blocks">/);
    expect(lessonPageMarkup).not.toMatch(/<iframe[^>]+player\.vimeo\.com/);
    for (const label of labels) {
      expect(lessonPageMarkup).not.toContain(label);
    }
  });
});

describe("deferred lesson body DOM contract", () => {
  it("uses an empty mount point for non-member viewers", () => {
    expect(lessonPageSource).toMatch(
      new RegExp(
        `<div ${LESSON_MEMBER_BODY_MOUNT_ATTR} data-gated="content" hidden></div>`,
      ),
    );
  });
});
