import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDropShoulderBuilderNewPatternHref } from "./patternStorage";
import {
  DROP_SHOULDER_PATTERN_BUILDER_LANDING,
  DROP_SHOULDER_PATTERN_LANDING_CANONICAL_URL,
  DROP_SHOULDER_PATTERN_LANDING_IMAGE_SRC,
  DROP_SHOULDER_PATTERN_LANDING_MEMBER_CTA_LABEL,
  DROP_SHOULDER_PATTERN_LANDING_PATH,
  DROP_SHOULDER_PATTERN_LANDING_SIGN_IN_LABEL,
} from "./dropShoulderPatternLanding";
import { SOCKS_PATTERN_BUILDER_LANDING } from "./socksPatternLanding";
import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "./patternConstructionIdentity";
import {
  DROP_SHOULDER_CATALOG_PILL_REST,
  DROP_SHOULDER_PATTERN_POSSIBILITIES,
} from "./patternCatalogPossibilities";

const landingPage = readFileSync(resolve("src/pages/patterns/drop-shoulder/index.astro"), "utf8");
const builderPage = readFileSync(resolve("src/pages/patterns/drop-shoulder/builder.astro"), "utf8");
const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const socksLandingPage = readFileSync(resolve("src/pages/patterns/socks/index.astro"), "utf8");

function landingCopy(): string {
  return JSON.stringify(DROP_SHOULDER_PATTERN_BUILDER_LANDING);
}

describe("Drop Shoulder Sweater Pattern Builder landing page", () => {
  it("is a public crawlable landing page at /patterns/drop-shoulder", () => {
    expect(DROP_SHOULDER_PATTERN_LANDING_PATH).toBe("/patterns/drop-shoulder");
    expect(landingPage).toContain("export const prerender = true");
    expect(landingPage).toContain("DROP_SHOULDER_PATTERN_BUILDER_LANDING");
    expect(landingPage).toContain("PatternBuilderLandingPage");
    expect(landingPage).not.toContain("socksSavedPatternRedirect");
    expect(landingPage).toContain("landing.seo.canonicalUrl");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    expect(landingPage).not.toContain("noindex");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.seo.title).toBe(
      "Drop Shoulder Sweater Pattern Builder | Knit it Now",
    );
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.seo.canonicalUrl).toBe(
      DROP_SHOULDER_PATTERN_LANDING_CANONICAL_URL,
    );
    expect(DROP_SHOULDER_PATTERN_LANDING_CANONICAL_URL).toBe(
      "https://knititnow.com/patterns/drop-shoulder",
    );
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.patternName).toBe(
      "Drop Shoulder Sweater Pattern Builder",
    );
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.headline).toBe(
      "Create a Custom Drop Shoulder Sweater Pattern",
    );
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.intro).toBe(
      "Choose a starting size, fit, sleeve length, and knitting gauge. The builder does the math and creates a personalized drop shoulder sweater pattern for your yarn and your machine.",
    );
    expect(existsSync(resolve(`public${DROP_SHOULDER_PATTERN_LANDING_IMAGE_SRC}`))).toBe(true);
    expect(DROP_SHOULDER_PATTERN_LANDING_IMAGE_SRC).toBe("/images/patterns/drop_shoulder.webp");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.catalogBadge).toEqual({
      count: DROP_SHOULDER_PATTERN_POSSIBILITIES,
      rest: DROP_SHOULDER_CATALOG_PILL_REST,
    });
    const dropShoulderLandingConfig = readFileSync(
      resolve("src/lib/patterns/dropShoulderPatternLanding.ts"),
      "utf8",
    );
    expect(dropShoulderLandingConfig).toContain("DROP_SHOULDER_PATTERN_POSSIBILITIES");
    expect(dropShoulderLandingConfig).toContain("DROP_SHOULDER_CATALOG_PILL_REST");
    expect(dropShoulderLandingConfig).not.toContain('"Patterns for Anyone"');
    expect(landingPage).not.toContain("Patterns for Anyone");
  });

  it("leaves the member-only builder route unchanged", () => {
    expect(buildDropShoulderBuilderNewPatternHref()).toBe(
      "/patterns/drop-shoulder/builder?new=1",
    );
    expect(builderPage).toContain("SleevelessPatternMemberGate");
    expect(builderPage).toContain('data-express-page="drop-shoulder-builder"');
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/drop-shoulder/builder?new=1",
    );
  });

  it("shows membership CTAs and sign-in for visitors without access", () => {
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.prospectLabel).toBe("Become a Member");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.prospectHref).toBe("/membership");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.signInLabel).toBe(
      DROP_SHOULDER_PATTERN_LANDING_SIGN_IN_LABEL,
    );
    expect(DROP_SHOULDER_PATTERN_LANDING_SIGN_IN_LABEL).toBe("Already a member? Sign in");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    const hero = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingHero.astro"),
      "utf8",
    );
    expect(hero).toContain('data-testid="pattern-builder-landing-prospect-cta"');
    expect(hero).toContain('data-ms-modal="login"');
  });

  it("shows Create My Pattern for members and links to the builder", () => {
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe(
      DROP_SHOULDER_PATTERN_LANDING_MEMBER_CTA_LABEL,
    );
    expect(DROP_SHOULDER_PATTERN_LANDING_MEMBER_CTA_LABEL).toBe("Create My Pattern");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      buildDropShoulderBuilderNewPatternHref(),
    );
  });

  it("uses genuine Drop Shoulder builder choices rather than invented options", () => {
    const choiceTitles =
      DROP_SHOULDER_PATTERN_BUILDER_LANDING.choices?.items.map((item) => item.title) ?? [];
    expect(choiceTitles).toEqual([
      "Cardigan or pullover",
      "Fit",
      "Sleeve length",
      "Your stitch and row gauge",
    ]);
    expect(
      DROP_SHOULDER_PATTERN_BUILDER_LANDING.choices?.items.find(
        (item) => item.title === "Sleeve length",
      )?.description,
    ).toBe("Choose long, 3/4, elbow, or short sleeves.");
    expect(DROP_SHOULDER_SLEEVE_LENGTH_CHOICES).toEqual(["long", "three-quarter", "elbow", "short"]);
    const allCopy = landingCopy();
    expect(allCopy).toMatch(/cardigan/i);
    expect(allCopy).toMatch(/pullover/i);
    expect(allCopy).toMatch(/long/i);
    expect(allCopy).toMatch(/3\/4/);
    expect(allCopy).toMatch(/elbow/i);
    expect(allCopy).toMatch(/short/i);
    expect(allCopy).not.toMatch(/testimonial/i);
    expect(allCopy).not.toMatch(/FAQ/i);
    expect(allCopy).not.toMatch(/\$\d/);
    expect(builderPage).toContain("Pullover");
    expect(builderPage).toContain("Cardigan");
    expect(builderPage).toContain("Close fit");
    expect(builderPage).toContain("Choose your sleeve length");
    expect(builderPage).toContain("Enter your gauge");
  });

  it("does not claim unsupported builder features", () => {
    const choiceCopy = (DROP_SHOULDER_PATTERN_BUILDER_LANDING.choices?.items ?? [])
      .map((item) => `${item.title} ${item.description}`)
      .join(" ");
    expect(choiceCopy).not.toMatch(/garment length/i);
    expect(choiceCopy).not.toMatch(/cuff-up/i);
    expect(choiceCopy).not.toMatch(/top-down/i);
    expect(choiceCopy).not.toMatch(/body shape/i);
    expect(choiceCopy).not.toMatch(/A-line/i);
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.creates?.body.join(" ")).toMatch(
      /cuff-up or top-down/,
    );
  });

  it("includes How it works without adding it to Socks", () => {
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.howItWorks?.heading).toBe("How it works");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.howItWorks?.body).toEqual([
      "Choose a starting size, then select pullover or cardigan, neckline, finished fit, and sleeve length.",
      "Enter the stitch and row gauge from your swatch. The builder calculates the stitch and row counts for each step and creates a pattern you can follow from the screen or print to use at your machine.",
    ]);
    expect(SOCKS_PATTERN_BUILDER_LANDING.howItWorks).toBeUndefined();
  });

  it("uses the revised creates copy without a Knit-able section", () => {
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.creates?.body).toEqual([
      "The builder creates a custom drop shoulder sweater pattern with the stitch counts, row counts, and knitting instructions for the size, fit, and style you choose.",
      "Sleeves can be knit cuff-up or top-down from the finished pattern.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
      "While your membership is active, you can update the size, yarn, gauge, or style choices and let the builder recalculate the pattern for you.",
    ]);
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.knitAble).toBeUndefined();
  });

  it("does not change the Socks landing page", () => {
    expect(socksLandingPage).toContain("SOCKS_PATTERN_BUILDER_LANDING");
    expect(socksLandingPage).toContain("socksSavedPatternRedirect");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe("/patterns/socks/builder?new=1");
  });

  it("explains former-member read-only access in the membership block", () => {
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.membershipBody).toBe(
      "The Drop Shoulder Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    );
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.cta.membershipNote).toBe(
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    );
  });
});

describe("Drop Shoulder landing page inbound links", () => {
  it("points the Patterns catalog Drop Shoulder card to the public landing page", () => {
    expect(catalog).toContain("href: '/patterns/drop-shoulder'");
    expect(catalog).not.toContain("href: '/patterns/drop-shoulder/builder?new=1'");
    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("image: '/images/patterns/drop_shoulder.webp'");
  });
});
