import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const homeView = readFileSync(join(root, "src/components/kinCourse/KinCourseHomeView.astro"), "utf8");
const header = readFileSync(join(root, "src/components/kinCourse/KinCourseHeader.astro"), "utf8");
const indexPage = readFileSync(join(root, "src/pages/courses/[courseSlug]/index.astro"), "utf8");
const lessonPage = readFileSync(
  join(root, "src/pages/courses/[courseSlug]/lesson/[assignId].astro"),
  "utf8",
);
const contentsPage = readFileSync(join(root, "src/pages/courses/[courseSlug]/contents.astro"), "utf8");
const landingCss = readFileSync(join(root, "src/styles/kin-course/course-shell.css"), "utf8");

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*,[^{]*\\{([^}]+)\\}`));
  if (match) return match[1];
  const single = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  return single?.[1] ?? "";
}

describe("live course landing page chrome colors", () => {
  it("uses one shared home view for both live numeric course landings", () => {
    expect(indexPage).toContain("KinCourseHomeView");
    expect(indexPage).toContain("parseKinCourseId");
    expect(homeView).toContain('pageClass="course-home-page"');
    expect(homeView).toContain("Start Course");
    expect(homeView).toContain("View Course Contents");
    expect(homeView).toContain('class="course-home-start"');
    expect(homeView).toContain('class="course-home-contents"');
    expect(header).toContain('class="kin-site-wordmark"');
    expect(header).toContain("Back to Courses");
  });

  it("keeps lesson and contents pages off the landing-only white-text selectors", () => {
    expect(lessonPage).toContain('pageClass="course-lesson-page"');
    expect(lessonPage).not.toContain("course-home-page");
    expect(contentsPage).not.toContain("course-home-page");
    expect(landingCss).toContain(".course-home-page .kin-site-brand:visited");
    expect(landingCss).toContain(".course-home-page .kin-site-back:visited");
    expect(landingCss).toContain(".course-home-page .course-home-start:visited");
    expect(landingCss).not.toMatch(/\.course-lesson-page[\s\S]{0,80}\.kin-site-brand:visited/);
  });

  it("sets header links and Start Course to white for link, visited, hover, and focus", () => {
    const brand = ruleBody(landingCss, ".course-home-page .kin-site-brand:visited");
    const back = ruleBody(landingCss, ".course-home-page .kin-site-back:visited");
    const start = ruleBody(landingCss, ".course-home-page .course-home-start:visited");

    for (const body of [brand, back, start]) {
      expect(body).toMatch(/color:\s*#fff/);
    }

    for (const selector of [
      ".course-home-page .kin-site-brand:link",
      ".course-home-page .kin-site-brand:visited",
      ".course-home-page .kin-site-brand:hover",
      ".course-home-page .kin-site-brand:focus",
      ".course-home-page .kin-site-back:link",
      ".course-home-page .kin-site-back:visited",
      ".course-home-page .kin-site-back:hover",
      ".course-home-page .kin-site-back:focus",
      ".course-home-page .course-home-start:link",
      ".course-home-page .course-home-start:visited",
      ".course-home-page .course-home-start:hover",
      ".course-home-page .course-home-start:focus",
    ]) {
      expect(landingCss).toContain(selector);
    }
  });

  it("keeps View Course Contents as a white button with green text", () => {
    expect(landingCss).toMatch(
      /\.course-home-contents\s*\{\s*background:\s*#fff;\s*color:\s*#52682d;/,
    );
    expect(landingCss).not.toContain(".course-home-page .course-home-contents:visited");
  });
});
