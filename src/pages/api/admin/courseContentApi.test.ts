import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("POST /api/admin/course-content", () => {
  const source = fs.readFileSync(
    path.resolve("src/pages/api/admin/course-content.ts"),
    "utf8",
  );

  it("blocks production hosts before any write", () => {
    expect(source).toContain("isCourseContentAdminAllowed");
    expect(source).toContain("adminBlockedResponse");
  });

  it("requires a Watson session for deployed writes", () => {
    expect(source).toContain("courseContentWriteRequiresWatsonSession");
    expect(source).toContain("requireWatsonSessionJson");
    const postIdx = source.indexOf("export const POST");
    expect(postIdx).toBeGreaterThan(-1);
    expect(source.indexOf("requireWatsonSessionJson", postIdx)).toBeGreaterThan(postIdx);
    expect(source.indexOf("export const GET")).toBeGreaterThan(-1);
    const getBlock = source.slice(
      source.indexOf("export const GET"),
      source.indexOf("export const POST"),
    );
    expect(getBlock).not.toContain("requireWatsonSessionJson");
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
