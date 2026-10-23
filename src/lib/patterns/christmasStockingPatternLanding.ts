/**
 * Christmas Stocking Pattern Builder public landing-page copy.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import { buildSockBuilderNewPatternHref } from "./christmasStocking/sockFreshStart";
import { BASIC_SOCK_PATTERN_NAME } from "./christmasStocking/sockDraft";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";

export const CHRISTMAS_STOCKING_PATTERN_LANDING_PATH = "/patterns/christmas-stocking";
export const CHRISTMAS_STOCKING_PATTERN_LANDING_CANONICAL_URL =
  "https://knititnow.com/patterns/christmas-stocking";

export const CHRISTMAS_STOCKING_PATTERN_LANDING_IMAGE_SRC =
  "/images/patterns/christmas-stocking-builder.png";

export const CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: `${BASIC_SOCK_PATTERN_NAME} Pattern Builder`,
  headline: "One Christmas stocking, in your yarn and your gauge",
  intro:
    "Create one machine-knit stocking from finished leg length, foot circumference, and foot length. Knit it cuff down or toe up. The builder calculates the short-row heel and toe.",
  image: {
    src: CHRISTMAS_STOCKING_PATTERN_LANDING_IMAGE_SRC,
    alt: "Line drawing of Christmas stockings. The tree and snowflake are decorative, not stitch charts.",
  },
  seo: {
    title: "Christmas Stocking Pattern Builder | Knit it Now",
    description:
      "Create one custom machine-knit Christmas stocking from finished measurements and your gauge. Cuff down or toe up. Included with Knit It Now membership.",
    canonicalUrl: CHRISTMAS_STOCKING_PATTERN_LANDING_CANONICAL_URL,
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Finished size",
        description:
          "Pick Mini through Extra Large. Leg length runs from the top edge to the start of the heel and includes the top edging. Foot circumference and leg circumference are the same.",
      },
      {
        title: "Cuff down or Toe up",
        description: "Choose the knitting order. Both directions finish to the same measurements.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter the gauge from your swatch over 4 inches / 10 cm. Heel and toe are plain knitting. Stitch patterns on the leg and foot are up to you.",
      },
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "Members receive instructions for one stocking: stitch and row counts, a short-row heel, a short-row toe, and finishing. There is no second stocking.",
      "The top edge — ribbing, a rolled edge, or another finish — is worked inside the leg length. An optional hanging loop can be an i-cord or twisted cord in a length you choose.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "This is not a pattern written for one knitting machine. Enter the gauge you achieved with your yarn and machine, and the builder calculates one stocking.",
    ],
  },
  cta: {
    memberLabel: "Create My Stocking",
    memberHref: buildSockBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: "Already a member? Sign in",
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Christmas Stocking Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
