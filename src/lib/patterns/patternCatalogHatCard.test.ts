import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PATTERN_CATALOG_MEMBERSHIP_BODY,
  PATTERN_CATALOG_MORE_HEADING,
} from "./patternsLandingCta";

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

function catalogSlice(startMarker: string, endMarker: string): string {
  const start = catalog.indexOf(startMarker);
  const end = catalog.indexOf(endMarker);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return catalog.slice(start, end);
}

describe("pattern catalog Hat card", () => {
  it("lists Hat as an available card using the production builder photo and route", () => {
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).toContain("image: HAT_PATTERN_HERO_IMAGE_SRC");
    expect(catalog).not.toContain("/images/patterns/Hat_builder.png");
    expect(catalog).toContain(
      "copy: 'Knit a hat that actually fits with brim choices, custom sizing, and machine-friendly instructions.'",
    );
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).not.toContain("title: 'Hat Pattern Builder'");
    expect(catalog).not.toContain("/images/patterns/basic-hat.webp");
    expect(catalog).not.toContain("Hat Pattern Builder — POSTPONED");
    expect(catalog).toContain("object-fit: contain");
    expect(catalog).not.toContain("object-fit: cover");
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
    expect(PATTERN_CATALOG_MORE_HEADING).toBe("More Pattern Builders");
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
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).not.toMatch(/href:\s*['"]\/patterns\/hat\/builder['"]/);
    expect(catalog).not.toMatch(/href:\s*['"]\/patterns\/hat['"]/);
  });

  it("Create your hat and the guest featured CTA start a new Hat session, not a draft resume", () => {
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).toContain("{hatPattern.href}");
    expect(catalog).toContain("CREATE MY FREE HAT PATTERN");
    expect(catalog).toContain("href: '/patterns/sleeveless/builder?new=1'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder/builder?new=1'");
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
    expect(catalog).toContain("image: '/images/patterns/sleeveless.webp'");
    expect(catalog).toContain("button: 'Create sleeveless sweater'");

    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder/builder?new=1'");
    expect(catalog).toContain("image: '/images/patterns/drop_shoulder.webp'");
    expect(catalog).toContain("button: 'Create drop shoulder sweater'");
  });

  it("features the free Hat for guests and keeps the standard card catalog for members", () => {
    const guest = catalogSlice('data-patterns-catalog="guest"', 'data-patterns-catalog="member"');
    const member = catalogSlice('data-patterns-catalog="member"', 'id="patterns-coming-heading"');

    expect(guest).toContain("patterns-featured");
    expect(guest).toContain("Try a Pattern Builder Free");
    expect(guest).toContain("Create Your Custom Hat Pattern");
    expect(guest).toContain(
      "Enter your gauge, choose your size and style, and create custom knitting instructions for your machine and yarn.",
    );
    expect(guest).toContain(">Free</span>");
    expect(guest).toContain("CREATE MY FREE HAT PATTERN");
    expect(guest).toContain("Free. No account or password needed.");
    expect(guest).toContain("{hatPattern.href}");
    expect(guest).toContain("{featuredHatImageSrc}");
    expect(guest).not.toContain("{hatPattern.image}");
    expect(guest).toContain("PATTERN_CATALOG_MORE_HEADING");
    expect(guest).toContain('id="sweater-patterns"');
    expect(guest).toMatch(
      /id="sweater-patterns"[\s\S]*class="patterns-catalog patterns-catalog--more"[\s\S]*PATTERN_CATALOG_MORE_HEADING/,
    );
    expect(guest).toContain("PATTERN_CATALOG_MEMBERSHIP_BODY");
    expect(guest).toContain("sweaterPatterns.map");
    expect(guest).toMatch(
      /PATTERN_CATALOG_MORE_HEADING[\s\S]*PATTERN_CATALOG_MEMBERSHIP_BODY[\s\S]*sweaterPatterns\.map/,
    );
    expect(guest).not.toContain("availablePatterns.map");
    expect(guest).not.toContain("Create your hat");

    expect(member).toContain("availablePatterns.map");
    expect(member).toContain('id="patterns-available-heading"');
    expect(member).toContain("Available now");
    expect(member).toContain("pattern.pillCount");
    expect(member).toContain("pattern.pillRest");
    expect(member).toContain("catalog-card");
    expect(member).not.toContain("patterns-featured");
    expect(member).not.toContain("Try a Pattern Builder Free");
    expect(member).not.toContain("CREATE MY FREE HAT PATTERN");
    expect(member).not.toContain("More Pattern Builders");
    expect(member).toMatch(/data-patterns-catalog="member" hidden/);

    expect(catalog).toContain('data-patterns-catalog="guest"');
    expect(catalog).toContain("initPatternsLandingCta");
    expect(catalog).toContain("data-patterns-page");
  });
});
