import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSleevelessBuilderNewPatternHref } from "./patternStorage";
import { SLEEVELESS_CATALOG_PILL_REST, SLEEVELESS_PATTERN_POSSIBILITIES } from "./patternCatalogPossibilities";
import {
  SLEEVELESS_PATTERN_BUILDER_LANDING,
  SLEEVELESS_PATTERN_LANDING_CANONICAL_URL,
  SLEEVELESS_PATTERN_LANDING_IMAGE_SRC,
  SLEEVELESS_PATTERN_LANDING_MEMBER_CTA_LABEL,
  SLEEVELESS_PATTERN_LANDING_PATH,
  SLEEVELESS_PATTERN_LANDING_SIGN_IN_LABEL,
} from "./sleevelessPatternLanding";
import { SOCKS_PATTERN_BUILDER_LANDING } from "./socksPatternLanding";

const landingPage = readFileSync(resolve("src/pages/patterns/sleeveless/index.astro"), "utf8");
const builderPage = readFileSync(resolve("src/pages/patterns/sleeveless/builder.astro"), "utf8");
const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const socksLandingPage = readFileSync(resolve("src/pages/patterns/socks/index.astro"), "utf8");

describe("Sleeveless Sweater Pattern Builder landing page", () => {
  it("is a public crawlable landing page at /patterns/sleeveless", () => {
    expect(SLEEVELESS_PATTERN_LANDING_PATH).toBe("/patterns/sleeveless");
    expect(landingPage).toContain("export const prerender = true");
    expect(landingPage).toContain("SLEEVELESS_PATTERN_BUILDER_LANDING");
    expect(landingPage).toContain("PatternBuilderLandingPage");
    expect(landingPage).not.toContain("socksSavedPatternRedirect");
    expect(landingPage).not.toContain("Astro.redirect");
    expect(landingPage).toContain("landing.seo.canonicalUrl");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    expect(landingPage).not.toContain("noindex");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.seo.title).toBe(
      "Sleeveless Sweater Pattern Builder | Knit it Now",
    );
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.seo.canonicalUrl).toBe(
      SLEEVELESS_PATTERN_LANDING_CANONICAL_URL,
    );
    expect(SLEEVELESS_PATTERN_LANDING_CANONICAL_URL).toBe(
      "https://knititnow.com/patterns/sleeveless",
    );
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.patternName).toBe(
      "Sleeveless Sweater Pattern Builder",
    );
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.headline).toBe(
      "Create a Custom Sleeveless Sweater Pattern",
    );
    expect(existsSync(resolve(`public${SLEEVELESS_PATTERN_LANDING_IMAGE_SRC}`))).toBe(true);
    expect(SLEEVELESS_PATTERN_LANDING_IMAGE_SRC).toBe("/images/patterns/sleeveless.webp");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.catalogBadge).toEqual({
      count: SLEEVELESS_PATTERN_POSSIBILITIES,
      rest: SLEEVELESS_CATALOG_PILL_REST,
    });
    const sleevelessLandingConfig = readFileSync(
      resolve("src/lib/patterns/sleevelessPatternLanding.ts"),
      "utf8",
    );
    expect(sleevelessLandingConfig).toContain("SLEEVELESS_PATTERN_POSSIBILITIES");
    expect(sleevelessLandingConfig).toContain("SLEEVELESS_CATALOG_PILL_REST");
    expect(sleevelessLandingConfig).not.toContain('"Styles in 1 Builder"');
    expect(landingPage).not.toContain("Styles in 1 Builder");
  });

  it("leaves the member-only builder route unchanged", () => {
    expect(buildSleevelessBuilderNewPatternHref()).toBe("/patterns/sleeveless/builder?new=1");
    expect(builderPage).toContain("SleevelessPatternMemberGate");
    expect(builderPage).toContain('data-express-page="sleeveless-builder"');
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/sleeveless/builder?new=1",
    );
  });

  it("shows membership CTAs and sign-in for visitors without access", () => {
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.prospectLabel).toBe("Become a Member");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.prospectHref).toBe("/membership");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.signInLabel).toBe(
      SLEEVELESS_PATTERN_LANDING_SIGN_IN_LABEL,
    );
    expect(SLEEVELESS_PATTERN_LANDING_SIGN_IN_LABEL).toBe("Already a member? Sign in");
    expect(landingPage).toContain("PatternBuilderLandingPage");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    const landingShell = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingPage.astro"),
      "utf8",
    );
    expect(landingShell).toContain('data-cta-mode="pending"');
    const hero = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingHero.astro"),
      "utf8",
    );
    expect(hero).toContain('data-testid="pattern-builder-landing-prospect-cta"');
    expect(hero).toContain('data-ms-modal="login"');
    expect(hero).toContain("{cta.prospectHref}");
    expect(hero).toContain("{cta.signInLabel}");
  });

  it("shows Create My Pattern for members and links to the builder", () => {
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe(
      SLEEVELESS_PATTERN_LANDING_MEMBER_CTA_LABEL,
    );
    expect(SLEEVELESS_PATTERN_LANDING_MEMBER_CTA_LABEL).toBe("Create My Pattern");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      buildSleevelessBuilderNewPatternHref(),
    );
    const hero = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingHero.astro"),
      "utf8",
    );
    expect(hero).toContain('data-testid="pattern-builder-landing-member-cta"');
    expect(hero).toContain("{cta.memberHref}");
    expect(hero).toContain("{cta.memberLabel}");
  });

  it("uses genuine Sleeveless builder choices rather than invented options", () => {
    const choiceTitles =
      SLEEVELESS_PATTERN_BUILDER_LANDING.choices?.items.map((item) => item.title) ?? [];
    expect(choiceTitles).toEqual([
      "Finished fit",
      "Your stitch and row gauge",
      "Your starting size",
      "Front and neckline",
    ]);
    expect(
      SLEEVELESS_PATTERN_BUILDER_LANDING.choices?.items.find(
        (item) => item.title === "Your starting size",
      )?.description,
    ).toBe(
      "Choose a starting size, then personalize the pattern with your preferred style and finished fit.",
    );
    const allCopy = JSON.stringify(SLEEVELESS_PATTERN_BUILDER_LANDING);
    expect(allCopy).toMatch(/close/i);
    expect(allCopy).toMatch(/standard/i);
    expect(allCopy).toMatch(/relaxed/i);
    expect(allCopy).toMatch(/pullover/i);
    expect(allCopy).toMatch(/cardigan/i);
    expect(allCopy).not.toMatch(/testimonial/i);
    expect(allCopy).not.toMatch(/FAQ/i);
    expect(allCopy).not.toMatch(/\$\d/);
    expect(builderPage).toContain("Close fit");
    expect(builderPage).toContain("Standard fit");
    expect(builderPage).toContain("Relaxed fit");
    expect(builderPage).toContain("Pullover");
    expect(builderPage).toContain("Cardigan");
    expect(builderPage).toContain("Enter your gauge");
  });

  it("includes How it works without adding it to Socks", () => {
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.howItWorks?.heading).toBe("How it works");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.howItWorks?.body).toEqual([
      "Choose a starting size, then select pullover or cardigan, neckline, and finished fit.",
      "Enter the stitch and row gauge from your swatch. The builder calculates the stitch and row counts for each step and creates a printable worksheet to use at your machine.",
    ]);
    expect(SOCKS_PATTERN_BUILDER_LANDING.howItWorks).toBeUndefined();
    const howComponent = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingHowItWorks.astro"),
      "utf8",
    );
    expect(howComponent).toContain("pattern-builder-how-it-works");
  });

  it("does not change the Socks landing page", () => {
    expect(socksLandingPage).toContain("SOCKS_PATTERN_BUILDER_LANDING");
    expect(socksLandingPage).toContain("socksSavedPatternRedirect");
    expect(socksLandingPage).toContain("PatternBuilderLandingPage");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe("/patterns/socks/builder?new=1");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe("Create My Sock Pattern");
  });

  it("uses the revised creates and any-yarn copy without a Knit-able section", () => {
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.creates?.body).toEqual([
      "The builder creates a custom sleeveless sweater pattern with the stitch counts, row counts, and knitting instructions for the size, fit, and style you choose.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
      "While your membership is active, you can update the size, yarn, gauge, or style choices and let the builder recalculate the pattern for you.",
    ]);
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.anyYarn?.heading).toBe("Any yarn. Any machine.");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.anyYarn?.body.at(-1)).toBe(
      "Use any suitable yarn on any knitting machine. Enter the gauge you achieved, and the builder calculates the pattern for you.",
    );
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.knitAble).toBeUndefined();
  });

  it("explains former-member read-only access in the membership block", () => {
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.membershipBody).toBe(
      "The Sleeveless Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    );
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.membershipNote).toBe(
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    );
  });
});

describe("Sleeveless landing page inbound links", () => {
  it("points the Patterns catalog Sleeveless card to the public landing page", () => {
    expect(catalog).toContain("href: '/patterns/sleeveless'");
    expect(catalog).not.toContain("href: '/patterns/sleeveless/builder?new=1'");
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("image: '/images/patterns/sleeveless.webp'");
  });
});
