import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PATTERN_CATALOG_MEMBERSHIP_BODY } from "./patternsLandingCta";

const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const hatBuilder = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
const sleevelessBuilder = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilder = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);

describe("pattern catalog Hat card", () => {
  it("lists Hat as an available card using the production builder photo and route", () => {
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("href: '/patterns/hat/builder'");
    expect(catalog).toContain("image: '/images/patterns/Hat_builder.png'");
    expect(catalog).toContain(
      "copy: 'Knit a hat that actually fits with brim choices, custom sizing, and machine-friendly instructions.'",
    );
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).not.toContain("title: 'Hat Pattern Builder'");
    expect(catalog).not.toContain("/images/patterns/basic-hat.webp");
    expect(catalog).not.toContain("Hat Pattern Builder — POSTPONED");
    expect(catalog).toContain("Choose a pattern to get started");
    expect(catalog).not.toContain("Pick a sweater builder");
    expect(catalog).not.toContain("Pattern Builders home");
    expect(catalog).not.toContain("patterns-intro__home-link");
  });

  it("stays public so a logged-out visitor can see membership info and the full catalog", () => {
    expect(catalog).not.toContain("SleevelessPatternMemberGate");
    expect(catalog).toContain("data-patterns-landing-cta");
    expect(catalog).toContain("PATTERN_CATALOG_MEMBERSHIP_BODY");
    expect(catalog).toContain("PATTERNS_LANDING_BECOME_MEMBER_LABEL");
    expect(catalog).toContain("PATTERNS_LANDING_LOGIN_LABEL");
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toMatch(/Sweater pattern builders are included/);
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toMatch(/free Hat Pattern/);
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(hatBuilder).toMatch(/Free\s*\/\s*ungated/i);
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).not.toContain("PatternBuilderAccountGate");
  });

  it("leaves sweater builders membership-gated and Hat ungated", () => {
    expect(sleevelessBuilder).toContain("SleevelessPatternMemberGate");
    expect(dropShoulderBuilder).toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
    expect(catalog).toContain("href: '/patterns/hat/builder'");
    expect(catalog).not.toMatch(/href:\s*['"]\/patterns\/hat['"]/);
  });

  it("swaps the hero action by login state: About for logged-out, My Patterns for logged-in", () => {
    const heroActions = catalog.match(
      /class="patterns-hero__actions"[\s\S]*?<\/header>/,
    )?.[0];

    expect(heroActions).toBeTruthy();
    expect(heroActions).toMatch(
      /data-ms-content="!members"[\s\S]*?href=\{PATTERN_BUILDERS_HOME_HREF\}[\s\S]*?data-testid="patterns-catalog-about"[\s\S]*?About Knit It Now Patterns/,
    );
    expect(heroActions).toMatch(
      /data-ms-content="members"[\s\S]*?PatternBuilderMyPatternsLink[\s\S]*?patterns-hero__btn/,
    );
  });

  it("leaves existing sweater catalog cards unchanged", () => {
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("href: '/patterns/sleeveless/builder?new=1'");
    expect(catalog).toContain(
      "image: '/images/patterns/sleeveless/people/sleeveless-woman-pullover-round-neck.webp'",
    );
    expect(catalog).toContain("button: 'Create sleeveless sweater'");

    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder/builder?new=1'");
    expect(catalog).toContain(
      "image: '/images/patterns/drop-shoulder/drop-man-pullover-round.webp'",
    );
    expect(catalog).toContain("button: 'Create drop shoulder sweater'");
  });
});
