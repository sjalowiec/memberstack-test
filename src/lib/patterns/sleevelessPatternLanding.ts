/**
 * Sleeveless Sweater Pattern Builder public landing-page copy.
 * Presentation lives in shared Pattern Builder landing components.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";
import { buildSleevelessBuilderNewPatternHref } from "./patternStorage";
import {
  SLEEVELESS_CATALOG_PILL_REST,
  SLEEVELESS_PATTERN_POSSIBILITIES,
} from "./patternCatalogPossibilities";

export const SLEEVELESS_PATTERN_LANDING_PATH = "/patterns/sleeveless";
export const SLEEVELESS_PATTERN_LANDING_CANONICAL_URL =
  "https://knititnow.com/patterns/sleeveless";

export const SLEEVELESS_PATTERN_LANDING_IMAGE_SRC = "/images/patterns/sleeveless.webp";

export const SLEEVELESS_PATTERN_LANDING_MEMBER_CTA_LABEL = "Create My Pattern";
export const SLEEVELESS_PATTERN_LANDING_SIGN_IN_LABEL = "Already a member? Sign in";

export const SLEEVELESS_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: "Sleeveless Sweater Pattern Builder",
  headline: "Create a Custom Sleeveless Sweater Pattern",
  intro:
    "Enter your measurements, fit preferences, and knitting gauge. The builder does the math and creates a personalized pattern for your yarn, your machine, and your size.",
  image: {
    src: SLEEVELESS_PATTERN_LANDING_IMAGE_SRC,
    alt: "A machine-knit sleeveless sweater",
  },
  catalogBadge: {
    count: SLEEVELESS_PATTERN_POSSIBILITIES,
    rest: SLEEVELESS_CATALOG_PILL_REST,
  },
  seo: {
    title: "Sleeveless Sweater Pattern Builder | Knit it Now",
    description:
      "Create a custom sleeveless sweater pattern from your measurements, fit, and gauge. The Sleeveless Sweater Pattern Builder is included with Knit It Now membership.",
    canonicalUrl: SLEEVELESS_PATTERN_LANDING_CANONICAL_URL,
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Finished fit",
        description:
          "Choose the finished fit you prefer: close, standard, or relaxed. Ease is added to the standard body measurements for your starting size.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter the gauge from your swatch over 4 inches / 10 cm. The pattern is calculated from the fabric you actually knit.",
      },
      {
        title: "Your starting size",
        description:
          "Choose a starting size, then personalize the pattern with your preferred style and finished fit.",
      },
      {
        title: "Front and neckline",
        description: "Choose a pullover or cardigan, with a round neck or V-neck.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    body: [
      "Choose a starting size, then select pullover or cardigan, neckline, and finished fit.",
      "Enter the stitch and row gauge from your swatch. The builder calculates the stitch and row counts for each step and creates a printable worksheet to use at your machine.",
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "The builder creates a custom sleeveless sweater pattern with the stitch counts, row counts, and knitting instructions for the size, fit, and style you choose.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
      "While your membership is active, you can update the size, yarn, gauge, or style choices and let the builder recalculate the pattern for you.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "Stop searching for a pattern that happens to match your gauge. Start with your gauge and create the sweater you want.",
      "Use any suitable yarn on any knitting machine. Enter the gauge you achieved, and the builder calculates the pattern for you.",
    ],
  },
  cta: {
    memberLabel: SLEEVELESS_PATTERN_LANDING_MEMBER_CTA_LABEL,
    memberHref: buildSleevelessBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: SLEEVELESS_PATTERN_LANDING_SIGN_IN_LABEL,
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Sleeveless Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
