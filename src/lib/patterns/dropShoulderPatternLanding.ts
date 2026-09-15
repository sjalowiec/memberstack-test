/**
 * Drop Shoulder Sweater Pattern Builder public landing-page copy.
 * Presentation lives in shared Pattern Builder landing components.
 *
 * Copy is limited to options the current Drop Shoulder builder actually supports.
 * Sleeve length is a builder picker. Cuff-up vs top-down is chosen on the finished
 * pattern, not in the builder wizard. There is no garment-length style picker.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";
import { buildDropShoulderBuilderNewPatternHref } from "./patternStorage";
import {
  DROP_SHOULDER_CATALOG_PILL_REST,
  DROP_SHOULDER_PATTERN_POSSIBILITIES,
} from "./patternCatalogPossibilities";

export const DROP_SHOULDER_PATTERN_LANDING_PATH = "/patterns/drop-shoulder";
export const DROP_SHOULDER_PATTERN_LANDING_CANONICAL_URL =
  "https://knititnow.com/patterns/drop-shoulder";

export const DROP_SHOULDER_PATTERN_LANDING_IMAGE_SRC = "/images/patterns/drop_shoulder.webp";

export const DROP_SHOULDER_PATTERN_LANDING_MEMBER_CTA_LABEL = "Create My Pattern";
export const DROP_SHOULDER_PATTERN_LANDING_SIGN_IN_LABEL = "Already a member? Sign in";

export const DROP_SHOULDER_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: "Drop Shoulder Sweater Pattern Builder",
  headline: "Create a Custom Drop Shoulder Sweater Pattern",
  intro:
    "Choose a starting size, fit, sleeve length, and knitting gauge. The builder does the math and creates a personalized drop shoulder sweater pattern for your yarn and your machine.",
  image: {
    src: DROP_SHOULDER_PATTERN_LANDING_IMAGE_SRC,
    alt: "A machine-knit drop shoulder sweater",
  },
  catalogBadge: {
    count: DROP_SHOULDER_PATTERN_POSSIBILITIES,
    rest: DROP_SHOULDER_CATALOG_PILL_REST,
  },
  seo: {
    title: "Drop Shoulder Sweater Pattern Builder | Knit it Now",
    description:
      "Create a custom drop shoulder sweater pattern from your measurements, fit, sleeve length, and gauge. The Drop Shoulder Sweater Pattern Builder is included with Knit It Now membership.",
    canonicalUrl: DROP_SHOULDER_PATTERN_LANDING_CANONICAL_URL,
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Cardigan or pullover",
        description: "Create a cardigan or a pullover, with a round neck or V-neck.",
      },
      {
        title: "Fit",
        description:
          "Choose the finished fit you prefer: close, standard, or relaxed. Ease is added to the standard body measurements for your starting size.",
      },
      {
        title: "Sleeve length",
        description: "Choose long, 3/4, elbow, or short sleeves.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter the gauge from your swatch over 4 inches / 10 cm. The pattern is calculated from the fabric you actually knit.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    body: [
      "Choose a starting size, then select pullover or cardigan, neckline, finished fit, and sleeve length.",
      "Enter the stitch and row gauge from your swatch. The builder calculates the stitch and row counts for each step and creates a pattern you can follow from the screen or print to use at your machine.",
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "The builder creates a custom drop shoulder sweater pattern with the stitch counts, row counts, and knitting instructions for the size, fit, and style you choose.",
      "Sleeves can be knit cuff-up or top-down from the finished pattern.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
      "While your membership is active, you can update the size, yarn, gauge, or style choices and let the builder recalculate the pattern for you.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "A dependable sweater shape, calculated for your gauge and the fit you want.",
      "Use any suitable yarn on any knitting machine. Enter the gauge you achieved, and the builder calculates the pattern for you.",
    ],
  },
  cta: {
    memberLabel: DROP_SHOULDER_PATTERN_LANDING_MEMBER_CTA_LABEL,
    memberHref: buildDropShoulderBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: DROP_SHOULDER_PATTERN_LANDING_SIGN_IN_LABEL,
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Drop Shoulder Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
