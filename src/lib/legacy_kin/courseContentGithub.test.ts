import { describe, expect, it, vi } from "vitest";

import {
  commitCourseContentFile,
  courseContentGithubRepoPath,
  parseGithubRepo,
  resolveCourseContentGithubBranch,
  resolveCourseContentGithubConfig,
} from "./courseContentGithub";

const validConfig = {
  token: "ghp_test_token",
  owner: "knititnow",
  repo: "knititnow-staging",
  branch: "dev",
};

describe("courseContentGithub constraints", () => {
  it("accepts discovered course poc filenames only", () => {
    expect(courseContentGithubRepoPath("course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json")).toBe(
      "src/data/legacy_kin/cleaned/course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json",
    );
  });

  it("rejects backups, nested paths, and non-poc files", () => {
    expect(() => courseContentGithubRepoPath("backups/course_111.poc.json")).toThrow(
      /invalid course content filename/,
    );
    expect(() =>
      courseContentGithubRepoPath("../course_111_mastering.poc.json"),
    ).toThrow(/invalid course content filename/);
    expect(() => courseContentGithubRepoPath("course_111.json")).toThrow(
      /invalid course content filename/,
    );
    expect(() => courseContentGithubRepoPath("secrets.txt")).toThrow(
      /invalid course content filename/,
    );
  });

  it("restricts writes to the configured dev branch", () => {
    expect(resolveCourseContentGithubBranch("dev")).toBe("dev");
    expect(resolveCourseContentGithubBranch("")).toBe("dev");
    expect(() => resolveCourseContentGithubBranch("main")).toThrow(/dev branch/);
    expect(() => resolveCourseContentGithubBranch("master")).toThrow(/dev branch/);
    expect(() => resolveCourseContentGithubBranch("feature/course-111")).toThrow(
      /dev branch/,
    );
  });

  it("requires owner/name repo form", () => {
    expect(parseGithubRepo("knititnow/knititnow-staging")).toEqual({
      owner: "knititnow",
      repo: "knititnow-staging",
    });
    expect(() => parseGithubRepo("https://github.com/knititnow/knititnow-staging")).toThrow(
      /owner\/name/,
    );
  });

  it("fails safely when GitHub credentials are missing", () => {
    expect(() =>
      resolveCourseContentGithubConfig({}, { readAstroEnv: false }),
    ).toThrow(/GITHUB_TOKEN is not configured/);
    expect(() =>
      resolveCourseContentGithubConfig(
        { GITHUB_TOKEN: "token-only" },
        { readAstroEnv: false },
      ),
    ).toThrow(/GITHUB_REPO is not configured/);
  });

  it("rejects a non-dev configured branch even when credentials exist", () => {
    expect(() =>
      resolveCourseContentGithubConfig(
        {
          GITHUB_TOKEN: "token",
          GITHUB_REPO: "knititnow/knititnow-staging",
          COURSE_CONTENT_GITHUB_BRANCH: "main",
        },
        { readAstroEnv: false },
      ),
    ).toThrow(/dev branch/);
  });
});

describe("commitCourseContentFile", () => {
  it("updates with the current GitHub file SHA and does not write other paths", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!init?.method || init.method === "GET") {
        expect(url).toContain(
          "/contents/src/data/legacy_kin/cleaned/course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json",
        );
        expect(url).toContain("ref=dev");
        return new Response(JSON.stringify({ sha: "current-file-sha" }), { status: 200 });
      }
      const body = JSON.parse(String(init.body)) as {
        sha?: string;
        branch?: string;
        content?: string;
      };
      expect(init.method).toBe("PUT");
      expect(body.sha).toBe("current-file-sha");
      expect(body.branch).toBe("dev");
      expect(body.content).toBeTruthy();
      return new Response(JSON.stringify({ commit: { sha: "new-commit-sha" } }), {
        status: 200,
      });
    });

    const result = await commitCourseContentFile({
      filename:
        "course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json",
      contents: "{}\n",
      courseId: 111,
      config: validConfig,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toEqual({
      commitSha: "new-commit-sha",
      branch: "dev",
      path: "src/data/legacy_kin/cleaned/course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json",
      fileSha: "current-file-sha",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
