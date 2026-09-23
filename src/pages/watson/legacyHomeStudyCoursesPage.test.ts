import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson legacy Home Study planning page", () => {
  const page = fs.readFileSync(
    path.resolve("src/pages/watson/legacy-home-study-courses.astro"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.resolve("src/components/watson/WatsonPageShell.astro"),
    "utf8",
  );
  const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");

  it("is an authenticated Watson page separate from course access", () => {
    expect(page).toContain("export const prerender = false");
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("Legacy Home Study Courses");
    expect(page).toContain("LEGACY_CREDIT_ENTRIES_LABEL");
    expect(page).toContain("LEGACY_HOME_STUDY_SNAPSHOT");
    expect(page).toContain("do not update automatically");
    expect(page).toContain("does not change customer course access");
    expect(page).toContain('method="post"');
    expect(page).toContain('name="q"');
    expect(page).toContain('data-sort-key="credit"');
    expect(page).toContain('data-sort-default="true"');
    expect(page).toContain("Other uses");
    expect(page).toContain("My private notes");
    expect(page).toContain("RECREATION_STATUSES");
    expect(page).not.toContain("verified sales");
    expect(page).not.toMatch(/homeStudyPurchase|homeStudyCreditEvidence|courseAccess/);
    expect(page).not.toMatch(/legacy_course_member_library/);
    expect(shell).toContain('href="/watson/legacy-home-study-courses"');
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("isWatsonRoute");
  });
});
