/**
 * Christmas Stocking Pattern Builder public landing-page copy.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import { CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN } from "./christmasStocking/christmasStockingMakeItYourOwn";
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
  headline: "Your Christmas stocking, in your yarn and your gauge",
  intro:
    "Create a machine-knit Christmas stocking in your choice of size and yarn. Knit cuff down or toe up, with stitch and row counts calculated from your gauge, including short-row heel and toe shaping.",
  makeItYourOwn: CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN,
  image: {
    src: CHRISTMAS_STOCKING_PATTERN_LANDING_IMAGE_SRC,
    alt: "Line drawing of Christmas stockings. The tree and snowflake are decorative, not stitch charts.",
  },
  seo: {
    title: "Christmas Stocking Pattern Builder | Knit it Now",
    description:
      "Create a machine-knit Christmas stocking in your choice of size and yarn. Cuff down or toe up, from your gauge. Included with Knit It Now membership.",
    canonicalUrl: CHRISTMAS_STOCKING_PATTERN_LANDING_CANONICAL_URL,
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Finished size",
        description:
          "Choose Mini through Extra Large. Leg length is measured from the top edge to the start of the heel and includes your chosen edging. The leg and foot have the same circumference.",
      },
      {
        title: "Cuff down or Toe up",
        description: "Start at the cuff or the toe. Choose the knitting direction you prefer.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter your swatch gauge over 4 inches / 10 cm. Keep the heel and toe plain, and personalize the leg and foot with your choice of stitch patterns.",
      },
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "Members receive personalized knitting instructions with stitch and row counts, short-row heel and toe shaping, and finishing directions.",
      "Your chosen top edging, such as ribbing or a rolled edge, is included in the finished leg length. Add an optional hanging loop using i-cord or twisted cord.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "Enter the gauge from your chosen yarn and knitting machine to create instructions tailored to your stocking.",
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
