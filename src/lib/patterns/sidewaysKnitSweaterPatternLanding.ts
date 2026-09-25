/**
 * Sideways Knit Sweater Pattern Builder public landing-page copy.
 * Presentation lives in shared Pattern Builder landing components.
 *
 * Customer-facing name is Sideways Knit Sweater (cardigan and pullover).
 * Internal routes and system IDs remain `sideways-cardigan`.
 *
 * Sleeve copy is limited to generated options: cuff-up and top-down, with
 * long / 3/4 / elbow / short lengths. Sideways sleeve knitting is not yet
 * connected and must not be claimed.
 *
 * Production hosts still block every `/patterns/sideways-cardigan` route.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";
import { buildSidewaysCardiganBuilderNewPatternHref } from "./patternStorage";

export const SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH = "/patterns/sideways-cardigan";
export const SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_CANONICAL_URL =
  "https://knititnow.com/patterns/sideways-cardigan";

export const SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC = "/images/patterns/sideways.png";

/** Pattern workspace header photo. Stays on the original render. */
export const SIDEWAYS_KNIT_SWEATER_PATTERN_THUMBNAIL_SRC = "/images/patterns/sideways.png";

export const SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_MEMBER_CTA_LABEL = "Create My Pattern";
export const SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_SIGN_IN_LABEL = "Already a member? Sign in";

export const SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: "Sideways Knit Sweater Pattern Builder",
  headline: "Create a Custom Sideways Knit Sweater Pattern",
  intro:
    "Knit the sweater body sideways to make better use of your needle bed. Choose a cardigan or pullover, starting size, fit, sleeve style, and knitting gauge. The builder calculates the pattern for your yarn and your machine.",
  image: {
    src: SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_IMAGE_SRC,
    alt: "A machine-knit sideways sweater",
  },
  seo: {
    title: "Sideways Knit Sweater Pattern Builder | Knit it Now",
    description:
      "Create a custom sideways-knit V-neck cardigan or pullover from your size, fit, sleeve choices, and gauge. Included with Knit It Now membership.",
    canonicalUrl: SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_CANONICAL_URL,
  },
  why: {
    heading: "More sizing flexibility",
    body: [
      "A sideways construction places the garment length across the needle bed instead of the full body width. This can make it possible to knit larger sweaters on machines with limited needle-bed width.",
      "Choose your size and enter your machine capacity. The builder checks the pattern against the number of needles available.",
    ],
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Cardigan or pullover",
        description: "Choose an open-front cardigan or a pullover with the fronts joined.",
      },
      {
        title: "Your starting size",
        description:
          "Choose from the available Misses or Women's sizes, then personalize the sweater with your preferred finished fit.",
      },
      {
        title: "Finished fit",
        description:
          "Choose close, standard, or relaxed fit. Ease is added to the standard body measurements for your starting size.",
      },
      {
        title: "Sleeve style",
        description: "Choose cuff-up or top-down sleeves, in long, 3/4, elbow, or short lengths.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter the gauge from your swatch over 4 inches / 10 cm. Because the garment is knitted sideways, stitch and row gauge are applied according to the knitting direction.",
      },
    ],
  },
  howItWorks: {
    heading: "How it works",
    body: [
      "Choose cardigan or pullover, a starting size, finished fit, and the supported sleeve options.",
      "Enter the stitch and row gauge from your swatch. The builder turns the sweater construction sideways and calculates the personalized stitch and row counts for each section.",
      "Knit from the screen or print a clean worksheet to use at your machine.",
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "The builder creates a custom V-neck cardigan or pullover pattern knitted sideways, with personalized stitch counts, row counts, and knitting instructions.",
      "Knitting the body sideways changes how the garment uses the needle bed. This can make larger finished bust sizes possible when a traditionally knitted sweater would require more needles than the machine holds.",
      "The advantage is greater flexibility, not unlimited sizing. The builder still checks whether the garment dimensions fit the entered machine capacity.",
      "While your membership is active, you can update the size, yarn, gauge, fit, or style choices and let the builder recalculate the pattern for you.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "Use any suitable yarn on any knitting machine. Enter the gauge you achieved, and the builder calculates the sideways pattern for you.",
    ],
  },
  cta: {
    memberLabel: SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_MEMBER_CTA_LABEL,
    memberHref: buildSidewaysCardiganBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_SIGN_IN_LABEL,
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Sideways Knit Sweater Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
