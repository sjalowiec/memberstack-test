/**
 * Set-in sleeve sweater builder landing copy.
 * Sleeves are knitted cuff-up. The public catalog card stays Coming Soon.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";
import { buildSetInSleeveBuilderNewPatternHref } from "./patternStorage";

export const SET_IN_SLEEVE_PATTERN_LANDING_PATH = "/patterns/set-in-sleeve";
export const SET_IN_SLEEVE_PATTERN_LANDING_CANONICAL_URL =
  "https://knititnow.com/patterns/set-in-sleeve";

export const SET_IN_SLEEVE_PATTERN_LANDING_IMAGE_SRC = "/images/patterns/set-in.png";

export const SET_IN_SLEEVE_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: "Set-In Sleeve Sweater Pattern Builder",
  headline: "Create a Custom Set-In Sleeve Sweater Pattern",
  intro:
    "A traditional set-in sleeve joins a shaped sleeve cap to a curved armhole at the shoulder. Choose a starting size, fit, sleeve length, and knitting gauge. The builder uses the sleeveless sweater body and adds cuff-up set-in sleeves.",
  image: {
    src: SET_IN_SLEEVE_PATTERN_LANDING_IMAGE_SRC,
    alt: "A machine-knit set-in sleeve sweater",
  },
  seo: {
    title: "Set-In Sleeve Sweater Pattern Builder | Knit it Now",
    description:
      "Create a custom set-in sleeve sweater pattern from your measurements, fit, sleeve length, and gauge. The Set-In Sleeve Sweater Pattern Builder is included with Knit It Now membership.",
    canonicalUrl: SET_IN_SLEEVE_PATTERN_LANDING_CANONICAL_URL,
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Cardigan or pullover",
        description: "Create a cardigan or a pullover, with a round neck or V-neck.",
      },
      {
        title: "Fit and body",
        description:
          "Choose close, standard, or relaxed fit. The body can be straight or A-line from your bust and hip measurements.",
      },
      {
        title: "Sleeve length",
        description: "Choose long, 3/4, elbow, or short sleeves. Sleeves are knitted cuff-up.",
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
      "Enter the stitch and row gauge from your swatch and the needles available on your machine. The builder calculates the body, the curved set-in armhole, and the matching sleeve cap.",
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "The builder creates a custom set-in sleeve sweater pattern with stitch counts, row counts, and knitting instructions for the size, fit, and style you choose.",
      "Sleeves are knitted from the cuff up. The sleeve cap is shaped to match the armhole.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
      "While your membership is active, you can update the size, yarn, gauge, or style choices and let the builder recalculate the pattern for you.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "A traditional set-in sleeve sweater, calculated for your gauge and the fit you want.",
      "Use any suitable yarn on any knitting machine. Enter the gauge you achieved, and the builder calculates the pattern for you.",
    ],
  },
  cta: {
    memberLabel: "Create My Pattern",
    memberHref: buildSetInSleeveBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: "Already a member? Sign in",
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Set-In Sleeve Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
