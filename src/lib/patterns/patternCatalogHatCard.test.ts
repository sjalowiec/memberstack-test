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
const socksBuilder = readFileSync(resolve("src/pages/patterns/socks/builder.astro"), "utf8");

function catalogSlice(startMarker: string, endMarker: string): string {
  const start = catalog.indexOf(startMarker);
  const end = catalog.indexOf(endMarker);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return catalog.slice(start, end);
}

describe("pattern catalog Hat card", () => {
  it("lists Hat as an available card using hat.webp and the production builder route", () => {
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).toContain("image: '/images/patterns/hat.webp'");
    expect(catalog).not.toContain("HAT_PATTERN_HERO_IMAGE_SRC");
    expect(catalog).not.toContain("/images/patterns/Hat_builder.png");
    expect(catalog).toContain(
      "copy: 'A hat in your gauge, with brim and crown choices and machine-knitting instructions.'",
    );
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).not.toContain("title: 'Hat Pattern Builder'");
    expect(catalog).not.toContain("/images/patterns/basic-hat.webp");
    expect(catalog).not.toContain("Hat Pattern Builder — POSTPONED");
    expect(catalog).toContain("object-fit: contain");
    expect(catalog).not.toContain("object-fit: cover");
    expect(catalog).toContain("Your Gauge. Your Size. Your Style. Your Pattern.");
    expect(catalog).toContain("Stop searching for a pattern that might work. Build one that works for you.");
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
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toMatch(/The Hat builder is free to try/);
    expect(PATTERN_CATALOG_MEMBERSHIP_BODY).toMatch(/other Pattern Builders are included/);
    expect(PATTERN_CATALOG_MORE_HEADING).toBe("Choose a Project");
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("title: 'Socks'");
    expect(hatBuilder).toMatch(/Free\s*\/\s*ungated/i);
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).not.toContain("PatternBuilderAccountGate");
  });

  it("leaves sweater builders and Socks membership-gated and Hat ungated", () => {
    expect(sleevelessBuilder).toContain("SleevelessPatternMemberGate");
    expect(dropShoulderBuilder).toContain("SleevelessPatternMemberGate");
    expect(socksBuilder).toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).not.toMatch(/href:\s*['"]\/patterns\/hat\/builder['"]/);
    expect(catalog).not.toMatch(/href:\s*['"]\/patterns\/hat['"]/);
  });

  it("Create your hat starts a new Hat session, not a draft resume", () => {
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).toContain("button: 'Create your hat'");
    expect(catalog).toContain("hatPattern,");
    expect(catalog).toContain("free: true");
    expect(catalog).toContain("href: '/patterns/sleeveless'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder'");
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
    expect(catalog).toContain("href: '/patterns/sleeveless'");
    expect(catalog).not.toContain("href: '/patterns/sleeveless/builder?new=1'");
    expect(catalog).toContain("image: '/images/patterns/sleeveless.webp'");
    expect(catalog).toContain("button: 'Create sleeveless sweater'");

    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder'");
    expect(catalog).not.toContain("href: '/patterns/drop-shoulder/builder?new=1'");
    expect(catalog).toContain("image: '/images/patterns/drop_shoulder.webp'");
    expect(catalog).toContain("button: 'Create drop shoulder sweater'");
  });

  it("lists Socks as an available card using socks-v2.png", () => {
    expect(catalog).toContain("title: 'Socks'");
    expect(catalog).toContain("href: '/patterns/socks'");
    expect(catalog).toContain("image: '/images/patterns/socks-v2.png'");
    expect(catalog).toContain("button: 'Create your socks'");
    expect(catalog).toContain("copy: SOCKS_CATALOG_COPY");
    expect(catalog).toContain("socksPattern");
  });

  it("features the free Hat inside the guest library and keeps a project library for members", () => {
    const guest = catalogSlice('data-patterns-catalog="guest"', 'data-patterns-catalog="member"');
    const member = catalogSlice('data-patterns-catalog="member"', 'id="patterns-coming-heading"');

    expect(guest).toContain("guestPatterns.map");
    expect(guest).toContain("data-testid={pattern.free ? \"patterns-featured-hat\" : undefined}");
    expect(guest).toContain(">Free. No account or password needed.</span>");
    expect(guest).toContain("Free. No account or password needed.");
    expect(guest).toContain("{pattern.image}");
    expect(guest).toContain("{pattern.button}");
    expect(catalog).toContain("image: '/images/patterns/hat.webp'");
    expect(catalog).not.toContain("HAT_PATTERN_HERO_IMAGE_SRC");
    expect(guest).toContain("PATTERN_CATALOG_MORE_HEADING");
    expect(guest).toContain("The Hat builder is free. Open a project and build it in your gauge.");
    expect(guest).toMatch(
      /PATTERN_CATALOG_MORE_HEADING[\s\S]*The Hat builder is free[\s\S]*guestPatterns\.map/,
    );
    expect(guest).not.toContain("availablePatterns.map");
    expect(guest).not.toContain("Become a Member");

    expect(member).toContain("availablePatterns.map");
    expect(member).toContain('id="patterns-available-heading"');
    expect(member).toContain("PATTERN_CATALOG_MORE_HEADING");
    expect(member).toContain("Open a builder and start with your gauge.");
    expect(member).toContain("catalog-card");
    expect(member).not.toContain("pattern.pillCount");
    expect(member).not.toContain("pattern.pillRest");
    expect(member).not.toContain("patterns-featured");
    expect(member).not.toContain("Free. No account or password needed.");
    expect(member).not.toContain("PATTERNS_LANDING_BECOME_MEMBER_LABEL");
    expect(member).toMatch(/data-patterns-catalog="member" hidden/);

    expect(catalog).toContain('data-patterns-catalog="guest"');
    expect(catalog).toContain("initPatternsLandingCta");
    expect(catalog).toContain("data-patterns-page");
    expect(catalog).toMatch(
      /id="patterns-membership-heading"[\s\S]*Included with membership[\s\S]*PATTERN_CATALOG_MEMBERSHIP_BODY[\s\S]*PATTERNS_LANDING_BECOME_MEMBER_LABEL/,
    );
    expect(catalog).toContain('data-patterns-audience="loggedOut"');
    expect(catalog).toContain('data-patterns-audience="loggedInNoAccess" hidden');
    expect(catalog).toContain("PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY");
    expect(catalog).toContain("PATTERNS_LANDING_JOIN_OR_RENEW_LABEL");
    const signedInActions = catalog.slice(
      catalog.lastIndexOf('data-patterns-audience="loggedInNoAccess"'),
      catalog.lastIndexOf("PATTERNS_LANDING_JOIN_OR_RENEW_LABEL") +
        "PATTERNS_LANDING_JOIN_OR_RENEW_LABEL".length,
    );
    expect(signedInActions).toContain("hidden");
    expect(signedInActions).not.toContain("PATTERNS_LANDING_LOGIN_LABEL");
    expect(catalog).toContain("Choose Your Project");
    expect(catalog).toContain("Make It Yours");
    expect(catalog).toContain("Create Your Pattern");
    expect(catalog).toContain("Made for machine knitters");
  });
});
