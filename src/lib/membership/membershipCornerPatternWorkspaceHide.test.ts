import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cornerCtaAstro = readFileSync(
  resolve("src/components/membership/MembershipCornerCta.astro"),
  "utf8",
);
const cornerControlAstro = readFileSync(
  resolve("src/components/membership/MembershipCornerControl.astro"),
  "utf8",
);
const baseLayoutAstro = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
const layoutAstro = readFileSync(resolve("src/layouts/Layout.astro"), "utf8");
const patternsIndexAstro = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const patternsAboutAstro = readFileSync(resolve("src/pages/patterns/about.astro"), "utf8");
const hatBuilder = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
const hatPattern = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const sleevelessBuilder = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const sleevelessPattern = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderBuilder = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const dropShoulderPattern = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const customBuildFit = readFileSync(
  resolve("src/pages/patterns/sleeveless/custom-build/fit/index.astro"),
  "utf8",
);
const sleevelessPrint = readFileSync(
  resolve("src/pages/patterns/sleeveless/print.astro"),
  "utf8",
);
const sleevelessBetaPrint = readFileSync(
  resolve("src/pages/patterns/sleeveless/beta-print.astro"),
  "utf8",
);
const coursesIndexAstro = readFileSync(resolve("src/pages/courses/index.astro"), "utf8");
const courseLandingAstro = readFileSync(
  resolve("src/pages/courses/[courseSlug].astro"),
  "utf8",
);
const legacyCourseOverviewAstro = readFileSync(
  resolve("src/pages/courses/legacy/[courseSlug]/index.astro"),
  "utf8",
);
const legacyLessonAstro = readFileSync(
  resolve("src/pages/courses/legacy/[courseSlug]/[lessonSlug].astro"),
  "utf8",
);
const legacyLessonItemAstro = readFileSync(
  resolve("src/pages/courses/legacy/[courseSlug]/[lessonSlug]/[itemSlug].astro"),
  "utf8",
);
const legacyLessonHtmlCompatAstro = readFileSync(
  resolve(
    "src/pages/courses/legacy/[courseSlug]/[lessonSlug]/legacy-html-compat.astro",
  ),
  "utf8",
);

describe("membership corner CTA — pattern workspace hide", () => {
  it("is mounted from BaseLayout only when hideMembershipCorner is false", () => {
    expect(baseLayoutAstro).toContain("hideMembershipCorner");
    expect(baseLayoutAstro).toMatch(
      /\{!\s*hideMembershipCorner\s*&&\s*<MembershipCornerControl\s*\/>\s*\}/,
    );
    expect(cornerControlAstro).toContain("MembershipCornerCta");
  });

  it("Layout derives hideMembershipCorner from patternWorkspace by default", () => {
    expect(layoutAstro).toContain("patternWorkspace");
    expect(layoutAstro).toContain("page--pattern-workspace");
    expect(layoutAstro).toContain("page--hide-membership-corner");
    expect(layoutAstro).toMatch(
      /hideMembershipCorner\s*=\s*hideMembershipCornerProp\s*\?\?\s*patternWorkspace/,
    );
    expect(layoutAstro).toContain("hideMembershipCorner={hideMembershipCorner}");
  });

  it("CSS hides the corner on pattern-workspace / hide-membership-corner body classes (no JS flash)", () => {
    expect(cornerCtaAstro).toMatch(
      /body\.page--pattern-workspace[\s\S]*?display:\s*none\s*!important/,
    );
    expect(cornerCtaAstro).toMatch(
      /body\.page--hide-membership-corner[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("hides the corner in print media", () => {
    expect(cornerCtaAstro).toMatch(
      /@media\s+print\s*\{[\s\S]*?data-membership-corner-cta[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("opts Builder / Edit / Custom Build / finished pattern workspaces into patternWorkspace", () => {
    for (const src of [
      hatBuilder,
      hatPattern,
      sleevelessBuilder,
      sleevelessPattern,
      dropShoulderBuilder,
      dropShoulderPattern,
      customBuildFit,
    ]) {
      expect(src).toContain("patternWorkspace={true}");
    }
  });

  it("opts sleeveless print routes into hideMembershipCorner without requiring phone workspace", () => {
    expect(sleevelessPrint).toContain("hideMembershipCorner={true}");
    expect(sleevelessBetaPrint).toContain("hideMembershipCorner={true}");
    expect(sleevelessPrint).not.toContain("patternWorkspace={true}");
    expect(sleevelessBetaPrint).not.toContain("patternWorkspace={true}");
  });

  it("keeps the Patterns catalog and promotional about page on the default (visible) corner CTA", () => {
    expect(patternsIndexAstro).not.toContain("patternWorkspace={true}");
    expect(patternsIndexAstro).not.toContain("hideMembershipCorner={true}");
    expect(patternsAboutAstro).not.toContain("patternWorkspace={true}");
    expect(patternsAboutAstro).not.toContain("hideMembershipCorner={true}");
  });

  it("opts course-player lesson routes into hideMembershipCorner without patternWorkspace", () => {
    for (const src of [
      legacyLessonAstro,
      legacyLessonItemAstro,
      legacyLessonHtmlCompatAstro,
    ]) {
      expect(src).toContain("hideMembershipCorner={true}");
      expect(src).not.toContain("patternWorkspace={true}");
    }
  });

  it("keeps course catalog, landing, and legacy overview on the default (visible) corner CTA", () => {
    for (const src of [coursesIndexAstro, courseLandingAstro, legacyCourseOverviewAstro]) {
      expect(src).not.toContain("hideMembershipCorner={true}");
      expect(src).not.toContain("patternWorkspace={true}");
    }
  });
});
