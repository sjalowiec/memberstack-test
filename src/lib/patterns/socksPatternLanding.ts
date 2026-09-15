/**
 * Basic Socks Pattern Builder public landing-page copy.
 * Presentation lives in shared Pattern Builder landing components.
 */

import { PATTERNS_LANDING_BECOME_MEMBER_HREF } from "./patternsLandingCta";
import { SOCK_CONSTRUCTION_DIRECTION_LABELS } from "./sock/sockPatternFromDraft";
import { buildSockBuilderNewPatternHref } from "./sock/sockFreshStart";
import { BASIC_SOCK_PATTERN_NAME } from "./sock/sockDraft";
import type { PatternBuilderLandingContent } from "./patternBuilderLanding";

export const SOCKS_PATTERN_LANDING_PATH = "/patterns/socks";
export const SOCKS_PATTERN_LANDING_CANONICAL_URL = "https://knititnow.com/patterns/socks";

export const SOCKS_PATTERN_LANDING_IMAGE_SRC = "/images/patterns/socks-v2.png";

export const SOCKS_PATTERN_LANDING_MEMBER_CTA_LABEL = "Create My Sock Pattern";
export const SOCKS_PATTERN_LANDING_SIGN_IN_LABEL = "Already a member? Sign in";

export const SOCKS_PATTERN_BUILDER_LANDING: PatternBuilderLandingContent = {
  patternName: `${BASIC_SOCK_PATTERN_NAME} Pattern Builder`,
  headline: "Socks that fit, using your yarn, your machine, and your gauge",
  intro:
    "Create a custom sock pattern based on the foot size, construction method, and gauge you choose. The builder does the calculations and gives you row-by-row knitting instructions.",
  image: {
    src: SOCKS_PATTERN_LANDING_IMAGE_SRC,
    alt: "A pair of machine-knit basic socks",
  },
  seo: {
    title: "Basic Socks Pattern Builder | Knit it Now",
    description:
      "Create a custom machine-knit sock pattern from your foot size, construction, and gauge. The Basic Socks Pattern Builder is included with Knit It Now membership.",
    canonicalUrl: SOCKS_PATTERN_LANDING_CANONICAL_URL,
  },
  why: {
    heading: "Why use this builder?",
    body: [
      "A generic sock pattern is written for someone else's yarn, machine, gauge, and foot. Yours are probably different.",
      "Recalculating sock shaping by hand is frustrating, and it is easy to miss a stitch or a row.",
      "Choose your size, construction, and gauge. The Basic Socks Pattern Builder turns those choices into practical knitting instructions.",
    ],
  },
  choices: {
    heading: "What you choose",
    items: [
      {
        title: "Foot size",
        description:
          "Pick a finished size based on foot circumference. After the pattern is created, you can fine-tune foot circumference, foot length, leg circumference, and leg length.",
      },
      {
        title: `${SOCK_CONSTRUCTION_DIRECTION_LABELS["cuff-to-toe"]} or ${SOCK_CONSTRUCTION_DIRECTION_LABELS["toe-up"]}`,
        description:
          "Choose the knitting order. Both directions use the same sock geometry.",
      },
      {
        title: "Your stitch and row gauge",
        description:
          "Enter the gauge from your swatch over 4 inches / 10 cm. The pattern is calculated from the fabric you actually knit.",
      },
    ],
  },
  creates: {
    heading: "What the builder creates",
    body: [
      "Members receive a custom sock pattern with the stitch counts, row counts, short-row heel and toe shaping, and finishing instructions for the size and construction they chose.",
      "Instructions are row-by-row, with technique videos and glossary help linked where you need them as you knit.",
      "While your membership is active, you can update the size, yarn, gauge, or construction choices and let the builder recalculate the pattern for you.",
    ],
  },
  anyYarn: {
    heading: "Any yarn. Any machine.",
    body: [
      "This is not a pattern written for one particular knitting machine. Enter the gauge you achieved with your yarn and machine, and the builder calculates the pattern for you.",
    ],
  },
  cta: {
    memberLabel: SOCKS_PATTERN_LANDING_MEMBER_CTA_LABEL,
    memberHref: buildSockBuilderNewPatternHref(),
    prospectLabel: "Become a Member",
    prospectHref: PATTERNS_LANDING_BECOME_MEMBER_HREF,
    signInLabel: SOCKS_PATTERN_LANDING_SIGN_IN_LABEL,
    membershipHeading: "Included with Knit It Now membership",
    membershipBody:
      "The Basic Socks Pattern Builder is included with a paid Knit It Now membership. There is nothing extra to buy for this pattern.",
    membershipNote:
      "Patterns you create remain in your account. If your membership ends, you can still view, print, and download them, but editing, recalculating, and creating new patterns require an active membership.",
    checkingLabel: "Checking membership…",
  },
};
