import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("POST /api/admin/course-content", () => {
  const source = fs.readFileSync(
    path.resolve("src/pages/api/admin/course-content.ts"),
    "utf8",
  );

  it("lets staff save drafts on production admin and publish only a previewed revision", () => {
    expect(source).not.toContain("isCourseContentAdminAllowed");
    expect(source).not.toContain("courseContentWriteRequiresWatsonSession");
    expect(source).not.toContain("requireWatsonSessionJson");
    expect(source).toContain('action === "createCourse"');
    expect(source).toContain('action === "previewDraft"');
    expect(source).toContain('action === "publishDraft"');
    expect(source).toContain("createPrivateCourse");
    expect(source).toContain("previewCourseDraft");
    expect(source).toContain("publishCourseDraft");
  });

  it("passes the request hostname into the persist adapter", () => {
    expect(source).toContain("commitCourseContentFile");
    expect(source).toContain("const writeOptions = {");
    expect(source).toContain("hostname,");
    expect(source).toContain("env: adminEnv");
    expect(source).toContain("await saveLessonUpdate");
  });

  it("does not mention GitHub credentials in the Course 111 browser editor", () => {
    const editor = fs.readFileSync(
      path.resolve("src/scripts/course111AdminEditor.ts"),
      "utf8",
    );
    const adminLib = fs.readFileSync(
      path.resolve("src/lib/legacy_kin/courseContentAdmin.ts"),
      "utf8",
    );
    expect(editor).not.toContain("GITHUB_TOKEN");
    expect(editor).not.toContain("GITHUB_REPO");
    expect(adminLib).not.toContain("GITHUB_TOKEN");
    expect(adminLib).not.toContain("./courseContentGithub");
  });
});
