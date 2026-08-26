import { describe, expect, it, vi } from "vitest";

import {
  applyLessonUpdate,
  isCourseContentAdminAllowed,
  readCourseContentFile,
  writeCourseContentFile,
} from "./courseContentAdmin";
import {
  courseContentWriteRequiresWatsonSession,
  resolveCourseContentPersistMode,
} from "./courseContentPersist";
import { COURSE_111_ID } from "./course111AdminModel";

describe("course content persist mode", () => {
  it("uses filesystem persistence on localhost", () => {
    expect(
      resolveCourseContentPersistMode({
        hostname: "localhost",
        env: { isViteDev: true },
      }),
    ).toBe("filesystem");
  });

  it("uses the GitHub writer for deployed kin-dev", () => {
    expect(
      resolveCourseContentPersistMode({
        hostname: "kin-dev.netlify.app",
        env: { isViteDev: false },
      }),
    ).toBe("github");
  });

  it("blocks production writes", () => {
    expect(() =>
      resolveCourseContentPersistMode({
        hostname: "knititnow.com",
        env: { isViteDev: false },
      }),
    ).toThrow(/blocked in production/);
    expect(
      isCourseContentAdminAllowed("knititnow.com", { isViteDev: false }),
    ).toBe(false);
  });

  it("requires Watson authentication for deployed writes only", () => {
    expect(
      courseContentWriteRequiresWatsonSession("localhost", { isViteDev: true }),
    ).toBe(false);
    expect(
      courseContentWriteRequiresWatsonSession("kin-dev.netlify.app", {
        isViteDev: false,
      }),
    ).toBe(true);
    expect(
      courseContentWriteRequiresWatsonSession("knititnow.com", {
        isViteDev: false,
      }),
    ).toBe(true);
  });
});

describe("writeCourseContentFile adapter", () => {
  it("does not write the filesystem when persisting through GitHub", async () => {
    const commitCourseContentFile = vi.fn(async () => ({
      commitSha: "abc123",
      branch: "dev",
      path: "src/data/legacy_kin/cleaned/course_50_lk150_quick.poc.json",
      fileSha: "file-sha",
    }));
    const data = readCourseContentFile(50);
    const result = await writeCourseContentFile(50, data, {
      hostname: "kin-dev.netlify.app",
      env: { isViteDev: false },
      commitCourseContentFile,
    });
    expect(commitCourseContentFile).toHaveBeenCalledTimes(1);
    expect(commitCourseContentFile.mock.calls[0]?.[0]?.filename).toBe(
      "course_50_lk150_quick.poc.json",
    );
    expect(result).toMatchObject({
      persistedVia: "github",
      branch: "dev",
      commitSha: "abc123",
      backupPath: "",
    });
  });

  it("fails if GitHub persist is selected without a writer", async () => {
    const data = readCourseContentFile(50);
    await expect(
      writeCourseContentFile(50, data, {
        hostname: "kin-dev.netlify.app",
        env: { isViteDev: false },
      }),
    ).rejects.toThrow(/GitHub course-content writer was not provided/);
  });
});

describe("Course 111 lesson replacement", () => {
  it("replaces one lesson and preserves the rest of the course document", () => {
    const original = structuredClone(readCourseContentFile(COURSE_111_ID));
    const target = original.lessons[0];
    if (!target) throw new Error("Course 111 has no lessons.");

    const edited = structuredClone(target);
    edited.title = `${target.title} (admin test title)`;
    const result = applyLessonUpdate(structuredClone(original), target.slug, edited);

    expect(result.data.course).toEqual(original.course);
    expect(result.data.lessons).toHaveLength(original.lessons.length);
    expect(result.data.lessons[0]?.title).toBe(`${target.title} (admin test title)`);
    expect(result.data.lessons.slice(1)).toEqual(original.lessons.slice(1));
    expect(original.lessons[0]?.title).toBe(target.title);
  });
});
