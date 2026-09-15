import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SOCK_BUILDER_PATH, buildSockBuilderNewPatternHref } from "./sock/sockFreshStart";
import {
  SOCKS_PATTERN_BUILDER_LANDING,
  SOCKS_PATTERN_LANDING_CANONICAL_URL,
  SOCKS_PATTERN_LANDING_IMAGE_SRC,
  SOCKS_PATTERN_LANDING_MEMBER_CTA_LABEL,
  SOCKS_PATTERN_LANDING_PATH,
  SOCKS_PATTERN_LANDING_SIGN_IN_LABEL,
} from "./socksPatternLanding";
import { SOCK_CONSTRUCTION_DIRECTION_LABELS } from "./sock/sockPatternFromDraft";
import { AVAILABLE_NEEDLES_LABEL } from "./sleevelessExpressAvailableNeedles";
import { BASIC_SOCK_PATTERN_NAME } from "./sock/sockDraft";
import {
  TEENAGE_KICKS_IMAGES,
  TEENAGE_KICKS_SOCKS_PATH,
  teenageKicksSockBuilderHref,
} from "../knit-ables/teenageKicksSocks";
import {
  KNIT_ABLES_LOGO,
  KNIT_ABLES_PAGE_LOGO_ALT,
  KNIT_ABLES_PATH,
} from "../knit-ables/knitAblesLanding";

const landingPage = readFileSync(resolve("src/pages/patterns/socks/index.astro"), "utf8");
const builderPage = readFileSync(resolve("src/pages/patterns/socks/builder.astro"), "utf8");
const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const teenageKicksPage = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);

describe("Basic Socks Pattern Builder landing page", () => {
  it("is a public crawlable landing page at /patterns/socks", () => {
    expect(SOCKS_PATTERN_LANDING_PATH).toBe("/patterns/socks");
    expect(landingPage).toContain("export const prerender = true");
    expect(landingPage).toContain("SOCKS_PATTERN_BUILDER_LANDING");
    expect(landingPage).toContain("PatternBuilderLandingPage");
    expect(landingPage).toContain("socksSavedPatternRedirect");
    expect(landingPage).toContain("landing.seo.canonicalUrl");
    expect(landingPage).not.toContain("SleevelessPatternMemberGate");
    expect(landingPage).not.toContain("noindex");
    expect(SOCKS_PATTERN_BUILDER_LANDING.seo.title).toBe(
      "Basic Socks Pattern Builder | Knit it Now",
    );
    expect(SOCKS_PATTERN_BUILDER_LANDING.seo.canonicalUrl).toBe(
      SOCKS_PATTERN_LANDING_CANONICAL_URL,
    );
    expect(SOCKS_PATTERN_LANDING_CANONICAL_URL).toBe("https://knititnow.com/patterns/socks");
    expect(SOCKS_PATTERN_BUILDER_LANDING.patternName).toBe(
      `${BASIC_SOCK_PATTERN_NAME} Pattern Builder`,
    );
    expect(existsSync(resolve(`public${SOCKS_PATTERN_LANDING_IMAGE_SRC}`))).toBe(true);
  });

  it("leaves the member-only builder route unchanged", () => {
    expect(SOCK_BUILDER_PATH).toBe("/patterns/socks/builder");
    expect(buildSockBuilderNewPatternHref()).toBe("/patterns/socks/builder?new=1");
    expect(builderPage).toContain("SleevelessPatternMemberGate");
    expect(builderPage).toContain('data-express-page="socks-builder"');
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      "/patterns/socks/builder?new=1",
    );
  });

  it("shows membership CTAs and sign-in for visitors without access", () => {
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.prospectLabel).toBe("Become a Member");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.prospectHref).toBe("/membership");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.signInLabel).toBe(
      SOCKS_PATTERN_LANDING_SIGN_IN_LABEL,
    );
    expect(SOCKS_PATTERN_LANDING_SIGN_IN_LABEL).toBe("Already a member? Sign in");
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

  it("shows Create My Sock Pattern for members and links to the builder", () => {
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberLabel).toBe(
      SOCKS_PATTERN_LANDING_MEMBER_CTA_LABEL,
    );
    expect(SOCKS_PATTERN_LANDING_MEMBER_CTA_LABEL).toBe("Create My Sock Pattern");
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.memberHref).toBe(
      buildSockBuilderNewPatternHref(),
    );
    const hero = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingHero.astro"),
      "utf8",
    );
    expect(hero).toContain('data-testid="pattern-builder-landing-member-cta"');
    expect(hero).toContain("{cta.memberHref}");
    expect(hero).toContain("{cta.memberLabel}");
  });

  it("uses genuine Socks builder choices rather than invented options", () => {
    const choiceTitles = SOCKS_PATTERN_BUILDER_LANDING.choices?.items.map((item) => item.title) ?? [];
    expect(choiceTitles).toEqual([
      "Foot size",
      `${SOCK_CONSTRUCTION_DIRECTION_LABELS["cuff-to-toe"]} or ${SOCK_CONSTRUCTION_DIRECTION_LABELS["toe-up"]}`,
      "Your stitch and row gauge",
    ]);
    expect(choiceTitles).toHaveLength(3);
    expect(choiceTitles).not.toContain(AVAILABLE_NEEDLES_LABEL);
    expect(SOCKS_PATTERN_BUILDER_LANDING.choices?.items.map((item) => item.title).join(" ")).not.toMatch(
      /needles available/i,
    );
    expect(builderPage).toContain("Cuff to Toe");
    expect(builderPage).toContain("Toe Up");
    expect(builderPage).toContain("Enter your gauge");
    expect(builderPage).toContain("AVAILABLE_NEEDLES_LABEL");
    expect(choiceTitles.join(" ")).not.toMatch(/cuff style/i);
    expect(choiceTitles.join(" ")).not.toMatch(/yarn weight/i);
  });

  it("omits Why use this builder from the Socks landing page only", () => {
    expect(SOCKS_PATTERN_BUILDER_LANDING.why).toBeUndefined();
    const socksConfig = readFileSync(resolve("src/lib/patterns/socksPatternLanding.ts"), "utf8");
    expect(socksConfig).not.toContain("Why use this builder?");
    const whyComponent = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingWhy.astro"),
      "utf8",
    );
    expect(whyComponent).toContain("pattern-builder-why");
    const landingShell = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingPage.astro"),
      "utf8",
    );
    expect(landingShell).toContain("{why ? <PatternBuilderLandingWhy section={why} /> : null}");
  });

  it("features the Teenage Kicks Knit-able with existing assets and routes", () => {
    const knitAble = SOCKS_PATTERN_BUILDER_LANDING.knitAble;
    expect(knitAble?.eyebrow).toBe("Knit-able Inspiration");
    expect(knitAble?.heading).toBe("See this pattern in action");
    expect(knitAble?.description).toBe(
      "Start with your custom Basic Socks pattern, then add color and creativity with the Teenage Kicks Knit-able.",
    );
    expect(knitAble?.buttonLabel).toBe("Explore Teenage Kicks");
    expect(knitAble?.href).toBe(TEENAGE_KICKS_SOCKS_PATH);
    expect(knitAble?.href).toBe("/knit-ables/teenage-kicks-socks");
    expect(knitAble?.image.src).toBe(TEENAGE_KICKS_IMAGES.hero.src);
    expect(knitAble?.image.src).toBe("/images/knit-ables/teenage-kicks-socks/56188220_2.jpg");
    expect(existsSync(resolve(`public${TEENAGE_KICKS_IMAGES.hero.src}`))).toBe(true);
    expect(knitAble?.logo.src).toBe(KNIT_ABLES_LOGO.src);
    expect(knitAble?.logo.href).toBe(KNIT_ABLES_PATH);
    expect(knitAble?.logo.href).toBe("/knit-ables");
    expect(knitAble?.logo.label).toBe(KNIT_ABLES_PAGE_LOGO_ALT);

    const knitAbleComponent = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingKnitAble.astro"),
      "utf8",
    );
    expect(knitAbleComponent).toContain('data-testid="pattern-builder-landing-knit-able-image"');
    expect(knitAbleComponent).toContain('data-testid="pattern-builder-landing-knit-able-cta"');
    expect(knitAbleComponent).toContain('data-testid="pattern-builder-landing-knit-able-logo"');
    expect(knitAbleComponent).toContain("href={section.href}");
    expect(knitAbleComponent).toContain("href={section.logo.href}");
    expect(knitAbleComponent).not.toContain("teenage-kicks-socks");
    expect(knitAbleComponent).not.toContain("/images/knit-ables");
  });

  it("explains that members can recalculate after changing their choices", () => {
    expect(SOCKS_PATTERN_BUILDER_LANDING.creates?.body).toContain(
      "While your membership is active, you can update the size, yarn, gauge, or construction choices and let the builder recalculate the pattern for you.",
    );
    const createsIndex = SOCKS_PATTERN_BUILDER_LANDING.creates?.body.indexOf(
      "While your membership is active, you can update the size, yarn, gauge, or construction choices and let the builder recalculate the pattern for you.",
    );
    expect(createsIndex).toBeGreaterThan(0);
  });

  it("explains former-member read-only access in the membership block", () => {
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.membershipBody).toBe(
      "The Basic Socks Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    );
    expect(SOCKS_PATTERN_BUILDER_LANDING.cta.membershipNote).toBe(
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    );
    const membership = readFileSync(
      resolve("src/components/patterns/PatternBuilderLandingMembershipCta.astro"),
      "utf8",
    );
    expect(membership).toContain("{cta.membershipBody}");
    expect(membership).toContain("{cta.membershipNote}");
    expect(membership).toMatch(
      /\{cta\.membershipNote\?\.trim\(\) \? <p>\{cta\.membershipNote\}<\/p> : null\}/,
    );
    expect(membership.indexOf("{cta.membershipNote}")).toBeGreaterThan(
      membership.indexOf("{cta.membershipBody}"),
    );
    expect(membership.indexOf("pattern-builder-membership__actions")).toBeGreaterThan(
      membership.indexOf("{cta.membershipNote}"),
    );
  });
});

describe("Socks landing page inbound links", () => {
  it("points the Patterns catalog Socks card to the public landing page", () => {
    expect(catalog).toContain("href: '/patterns/socks'");
    expect(catalog).toContain('data-socks-catalog-card');
    expect(catalog).not.toContain("href: '/patterns/socks/builder?new=1'");
    expect(catalog).toContain("title: 'Socks'");
    expect(catalog).toContain("image: '/images/patterns/socks-v2.png'");
  });

  it("points the Teenage Kicks Socks Pattern CTA to the public landing page", () => {
    expect(teenageKicksSockBuilderHref()).toBe(SOCKS_PATTERN_LANDING_PATH);
    expect(teenageKicksPage).toContain("teenageKicksSockBuilderHref()");
    expect(teenageKicksPage.match(/href=\{sockBuilderHref\}/g)?.length).toBe(2);
    expect(teenageKicksPage).not.toContain("/patterns/socks/builder");
  });
});
