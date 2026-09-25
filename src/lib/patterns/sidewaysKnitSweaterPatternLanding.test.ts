import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSidewaysCardiganBuilderNewPatternHref } from "./patternStorage";
import {
  SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_CANONICAL_URL,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_MEMBER_CTA_LABEL,
  SIDEWAYS_KNIT_SWEATER_PATTERN_THUMBNAIL_SRC,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_SIGN_IN_LABEL,
} from "./sidewaysKnitSweaterPatternLanding";
import { SLEEVELESS_PATTERN_BUILDER_LANDING } from "./sleevelessPatternLanding";
import { DROP_SHOULDER_PATTERN_BUILDER_LANDING } from "./dropShoulderPatternLanding";
import { SOCKS_PATTERN_BUILDER_LANDING } from "./socksPatternLanding";
import {
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES,
} from "./sidewaysCardiganConstructionIdentity";
import { isSidewaysCardiganProductionBlocked, isSidewaysCardiganRoute } from "./sidewaysCardiganProductionAccess";

const landingPage = readFileSync(resolve("src/pages/patterns/sideways-cardigan/index.astro"), "utf8");
const builderPage = readFileSync(resolve("src/pages/patterns/sideways-cardigan/builder.astro"), "utf8");
const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
const socksLandingPage = readFileSync(resolve("src/pages/patterns/socks/index.astro"), "utf8");
const sleevelessLandingPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/index.astro"),
  "utf8",
);
const dropShoulderLandingPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/index.astro"),
  "utf8",
);

function landingCopy(): string {
  return JSON.stringify(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING);
}

describe("Sideways Knit Sweater Pattern Builder landing page", () => {
  it("is a DEV landing page at /patterns/sideways-cardigan without prerendering", () => {
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH).toBe("/patterns/sideways-cardigan");
    expect(isSidewaysCardiganRoute(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH)).toBe(true);
    expect(landingPage).toContain("export const prerender = false");
    expect(landingPage).toContain("SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING");
    expect(landingPage).toContain("PatternBuilderLandingPage");
    expect(landingPage).not.toContain("socksSavedPatternRedirect");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    expect(landingPage).toContain("landing.seo.canonicalUrl");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.patternName).toBe(
      "Sideways Knit Sweater Pattern Builder",
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.headline).toBe(
      "Create a Custom Sideways Knit Sweater Pattern",
    );
    expect(landingCopy()).toContain("Sideways Knit Sweater");
    expect(landingCopy()).not.toMatch(/Sideways Cardigan Pattern Builder/);
    expect(existsSync(resolve(`public${SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC}`))).toBe(
      true,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC).toBe("/images/patterns/sideways.png");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.image.src).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.image.alt).toBe(
      "A machine-knit sideways sweater",
    );
    expect(existsSync(resolve("public/images/patterns/soft_sideways.png"))).toBe(true);
    expect(existsSync(resolve(`public${SIDEWAYS_KNIT_SWEATER_PATTERN_THUMBNAIL_SRC}`))).toBe(true);
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_THUMBNAIL_SRC).toBe("/images/patterns/sideways.png");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.seo.canonicalUrl).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_CANONICAL_URL,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.catalogBadge).toBeUndefined();
    const sidewaysLandingConfig = readFileSync(
      resolve("src/lib/patterns/sidewaysKnitSweaterPatternLanding.ts"),
      "utf8",
    );
    expect(sidewaysLandingConfig).not.toContain("catalogBadge");
    expect(sidewaysLandingConfig).not.toContain("CATALOG_PILL_REST");
  });

  it("leaves the member-only builder route unchanged", () => {
    expect(buildSidewaysCardiganBuilderNewPatternHref()).toBe(
      "/patterns/sideways-cardigan/builder?new=1",
    );
    expect(builderPage).toContain("SleevelessPatternMemberGate");
    expect(builderPage).toContain('data-express-page="sideways-cardigan-builder"');
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/sideways-cardigan/builder?new=1",
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_MEMBER_CTA_LABEL,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_MEMBER_CTA_LABEL).toBe("Create My Pattern");
  });

  it("shows membership CTAs and sign-in for visitors without access", () => {
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.prospectLabel).toBe("Become a Member");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.prospectHref).toBe("/membership");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.signInLabel).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_SIGN_IN_LABEL,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_SIGN_IN_LABEL).toBe("Already a member? Sign in");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.membershipNote).toBe(
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    );
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
  });

  it("uses genuine Sideways builder choices and does not claim unfinished sleeves", () => {
    const choiceTitles =
      SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.choices?.items.map((item) => item.title) ?? [];
    expect(choiceTitles).toEqual([
      "Cardigan or pullover",
      "Your starting size",
      "Finished fit",
      "Sleeve style",
      "Your stitch and row gauge",
    ]);
    expect(SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS).toEqual(["cuff-up", "top-down", "sideways"]);
    expect(SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES).toEqual([
      "long",
      "three-quarter",
      "elbow",
      "short",
    ]);
    const sleeveCard = SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.choices?.items.find(
      (item) => item.title === "Sleeve style",
    );
    expect(sleeveCard?.description).toBe(
      "Choose cuff-up or top-down sleeves, in long, 3/4, elbow, or short lengths.",
    );
    expect(sleeveCard?.description).not.toMatch(/sideways/i);
    expect(landingCopy()).not.toMatch(/not yet connected/i);
    expect(landingCopy()).toMatch(/not unlimited sizing/);
    expect(builderPage).toContain("Cardigan");
    expect(builderPage).toContain("Pullover");
    expect(builderPage).toContain("Close fit");
    expect(builderPage).toContain("Cuff up");
    expect(builderPage).toContain("Top down");
    expect(builderPage).toContain("Enter your gauge");
  });

  it("explains the larger-size and limited-needle-bed advantage without promising unlimited sizing", () => {
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.why?.heading).toBe("More sizing flexibility");
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.why?.body.join(" ")).toMatch(
      /limited needle-bed width/,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.creates?.body.join(" ")).toMatch(
      /larger finished bust sizes/,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.creates?.body.join(" ")).toMatch(
      /not unlimited sizing/,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.creates?.body.join(" ")).toMatch(
      /machine capacity/,
    );
    expect(SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.knitAble).toBeUndefined();
  });

  it("does not change Sleeveless, Drop Shoulder, or Socks landing pages", () => {
    expect(sleevelessLandingPage).toContain("SLEEVELESS_PATTERN_BUILDER_LANDING");
    expect(sleevelessLandingPage).toContain("export const prerender = true");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/sleeveless/builder?new=1",
    );
    expect(dropShoulderLandingPage).toContain("DROP_SHOULDER_PATTERN_BUILDER_LANDING");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/drop-shoulder/builder?new=1",
    );
    expect(socksLandingPage).toContain("SOCKS_PATTERN_BUILDER_LANDING");
    expect(socksLandingPage).toContain("socksSavedPatternRedirect");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe("/patterns/socks/builder?new=1");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe("Create My Sock Pattern");
  });
});

describe("Sideways landing production safety", () => {
  it("keeps production hosts blocked and middleware redirecting the landing path", () => {
    expect(isSidewaysCardiganProductionBlocked("knititnow.com")).toBe(true);
    expect(isSidewaysCardiganProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isSidewaysCardiganProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(middleware).toContain("isSidewaysCardiganRoute");
    expect(middleware).toContain("isSidewaysCardiganProductionBlocked");
    expect(middleware).toMatch(
      /isSidewaysCardiganRoute\(u\.pathname\)[\s\S]*isSidewaysCardiganProductionBlocked\(u\.hostname, devOnlyRouteEnv\)[\s\S]*context\.redirect\("\/patterns\/", 302\)/,
    );
  });
});

describe("Sideways landing page inbound links", () => {
  it("points the DEV catalog Sideways card to the public landing page", () => {
    expect(catalog).toContain("href: '/patterns/sideways-cardigan'");
    expect(catalog).not.toContain("href: '/patterns/sideways-cardigan/builder?new=1'");
    expect(catalog).toContain("title: 'Sideways Knit Sweater'");
    expect(catalog).toContain("image: '/images/patterns/sideways.png'");
    expect(catalog).toContain("showSidewaysAsComingSoon");
    expect(catalog).toContain("...(showSidewaysAsComingSoon ? [] : [sidewaysPattern])");
  });
});
