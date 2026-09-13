import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const editSource = readFileSync(join(here, "lessons-edit.astro"), "utf8");
const listSource = readFileSync(join(here, "lessons.astro"), "utf8");
const editorClientSource = readFileSync(
  join(here, "..", "..", "lib", "lessons", "adminEditorClient.ts"),
  "utf8",
);
const baseLayoutSource = readFileSync(join(here, "..", "..", "layouts", "BaseLayout.astro"), "utf8");

describe("Lesson admin CMS", () => {
  it("loads and saves through the admin API with a Memberstack bearer token", () => {
    expect(editSource).toContain("loadLessonBySlug");
    expect(editSource).toContain("installLessonAdminBrowser");
    expect(editSource).toContain("admin.request");
    expect(editSource).toContain("admin.saveSucceeded");
    expect(editSource).toContain("admin.openPreview");
    expect(editSource).toContain('id="lessonAdminSignIn"');
    expect(editSource).not.toContain("Copy Cursor Save Prompt");
    expect(editSource).not.toContain("src/data/lessons.json");
    expect(editSource).not.toContain("name=\"id\"");
    expect(editSource).toContain("Assigned automatically on first save");
  });

  it("exposes Preview through the authenticated admin client, not a public query string", () => {
    expect(editSource).toContain('id="previewLesson"');
    expect(editSource).toContain("admin.openPreview");
    expect(editSource).toContain('window.open("", "_blank")');
    expect(editSource).not.toContain("/lessons/preview?data=");
    expect(listSource).toContain("data-lesson-preview-slug");
    expect(listSource).toContain("bindLessonPreviewButtons");
    expect(listSource).toContain("loadLessonsForAdmin");
    expect(editorClientSource).toContain("document.write");
    expect(editorClientSource).toContain("htmlWithLessonPreviewBase");
    expect(editorClientSource).not.toContain("createObjectURL");
    expect(editorClientSource).not.toMatch(/new Blob\b/);
    expect(baseLayoutSource).toContain("<base href={documentBaseHref}");
  });

  it("shows Draft, Published, and Review and only reports Saved after success", () => {
    expect(editSource).toContain('value="review"');
    expect(editSource).toContain('setSaveStatus("Saved", "ok")');
    expect(editSource).toContain("Save failed");
    expect(listSource).toContain("Needs Review");
    expect(listSource).toContain("Draft");
    expect(listSource).toContain("Published");
  });
});
