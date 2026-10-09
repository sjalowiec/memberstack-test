import {
  SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH,
} from "../patterns/sidewaysKnitSweaterPatternLanding";
import type { KnitAbleInspirationPageContent } from "./inspirationPage";

export const RHYTHMIC_COLOUR_TOP_PATH = "/knit-ables/rhythmic-colour-top";

export const RHYTHMIC_COLOUR_TOP_CANONICAL_URL =
  "https://knititnow.com/knit-ables/rhythmic-colour-top";

export const RHYTHMIC_COLOUR_TOP_TITLE = "Rhythmic Colour Top";

export const RHYTHMIC_COLOUR_TOP_DESCRIPTION =
  "Crochet inspiration for a sideways machine-knit sweater. Create your own pullover or cardigan with the Knit It Now Sideways V-Neck Sweater Builder.";

/** Sirdar Rhythmic Colour Crochet Top pattern. Awin affiliate link. */
export const RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2F%2Fen%2Fproducts%2F10923-rhythmic-colour-crochet-top-crochet-pattern-in-sirdar-jewelspun-ombre";

/** Sirdar Jewelspun Aran shop page. Awin affiliate link. */
export const RHYTHMIC_COLOUR_TOP_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2F%2Fen%2Fproducts%2Fsirdar-jewelspun-aran-200g";

export const RHYTHMIC_COLOUR_TOP_IMAGES = {
  hero: {
    src: "/images/knit-ables/rhythmic-color.jpg",
    alt: "A person wearing a short-sleeved V-neck crochet top with vertical bands of magenta, orange, and pink.",
    width: 460,
    height: 602,
    fileName: "rhythmic-color.jpg",
  },
} as const;

export const RHYTHMIC_COLOUR_TOP_TAGLINE =
  "Crochet Inspiration. Machine Knitting Possibilities!";

export const RHYTHMIC_COLOUR_TOP_INTRO = [
  "Yes, this is crochet! But take a closer look.",
  "Sirdar's Rhythmic Colour Top is a wonderful example of how working sideways can create a striking garment, especially when you let the yarn do the colorwork.",
] as const;

export const RHYTHMIC_COLOUR_TOP_BUILDER_HEADING = "Make It Your Own";

export const RHYTHMIC_COLOUR_TOP_BUILDER_LINK_LABEL =
  "Knit It Now Sideways V-Neck Sweater Builder";

export const RHYTHMIC_COLOUR_TOP_BUILDER_COPY_BEFORE = "And here's the fun part! Use the ";

export const RHYTHMIC_COLOUR_TOP_BUILDER_COPY_AFTER = " to create your own version.";

export const RHYTHMIC_COLOUR_TOP_BUILD_STEPS = [
  { lead: "Pullover or cardigan?", text: "You choose!" },
  { lead: "Sleeves or sleeveless?", text: "Knit the sleeves or simply leave them off." },
  { lead: "Love those colors?", text: "Let a self-striping yarn do the work." },
  { lead: "Make it fit YOU!", text: "Your measurements. Your gauge." },
] as const;

export const RHYTHMIC_COLOUR_TOP_CROCHET_HEADING = "Do You Crochet?";

export const RHYTHMIC_COLOUR_TOP_CROCHET_INTRO = "Why not combine the best of both worlds?";

export const RHYTHMIC_COLOUR_TOP_CROCHET_BODY =
  "Machine knit your sideways sweater, then add a crochet edging to the neckline, armholes, or front edges.";

export const RHYTHMIC_COLOUR_TOP_CROCHET_CHOICE = "Who says you have to choose?";

export const RHYTHMIC_COLOUR_TOP_ANY_YARN =
  "Any yarn. Any machine. Your size. Your style.";

export const RHYTHMIC_COLOUR_TOP_INSPIRED_HEADING = "Inspired by Rhythmic Colour";

export const RHYTHMIC_COLOUR_TOP_INSPIRED_COPY =
  "This is inspiration, not a pattern conversion. Use the Sirdar design for ideas and the Knit It Now Builder to create your own sweater.";

export const RHYTHMIC_COLOUR_TOP_PATTERN_LINK_LABEL = "View the Original Crochet Pattern";

export const RHYTHMIC_COLOUR_TOP_YARN_HEADING = "Yarn Inspiration";

export const RHYTHMIC_COLOUR_TOP_YARN = {
  heading: "Sirdar Jewelspun Aran",
  paragraphs: [
    "Love the color changes? Explore Sirdar Jewelspun Aran or choose your own colorful yarn. Swatch on your machine and let YOUR gauge guide the pattern.",
  ],
  buttonLabel: "Explore Sirdar Jewelspun Aran",
  href: RHYTHMIC_COLOUR_TOP_YARN_URL,
} as const;

export const RHYTHMIC_COLOUR_TOP_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

export const RHYTHMIC_COLOUR_TOP_CARD_COPY =
  "Create your own sideways pullover or cardigan, inspired by this colorful crochet top, with the Sideways V-Neck Sweater Builder.";

export const RHYTHMIC_COLOUR_TOP_CTA_LABEL = "Create Your Own Sideways Sweater";

/** Same visitor actions as the Sideways Knit Sweater landing page. The button opens that landing page. */
export const RHYTHMIC_COLOUR_TOP_CTA = {
  ...SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta,
  memberLabel: RHYTHMIC_COLOUR_TOP_CTA_LABEL,
  memberHref: SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH,
};

/** Public Sideways V-Neck Sweater landing page. Internal route remains sideways-cardigan. */
export function rhythmicColourTopLandingHref(): string {
  return SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH;
}

/** Page content for the shared Knit-able inspiration template. */
export const RHYTHMIC_COLOUR_TOP_PAGE: KnitAbleInspirationPageContent = {
  path: RHYTHMIC_COLOUR_TOP_PATH,
  canonicalUrl: RHYTHMIC_COLOUR_TOP_CANONICAL_URL,
  title: RHYTHMIC_COLOUR_TOP_TITLE,
  description: RHYTHMIC_COLOUR_TOP_DESCRIPTION,
  hero: {
    src: RHYTHMIC_COLOUR_TOP_IMAGES.hero.src,
    alt: RHYTHMIC_COLOUR_TOP_IMAGES.hero.alt,
    width: RHYTHMIC_COLOUR_TOP_IMAGES.hero.width,
    height: RHYTHMIC_COLOUR_TOP_IMAGES.hero.height,
    href: RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL,
  },
  tagline: RHYTHMIC_COLOUR_TOP_TAGLINE,
  intro: RHYTHMIC_COLOUR_TOP_INTRO,
  builder: {
    heading: RHYTHMIC_COLOUR_TOP_BUILDER_HEADING,
    introduction: {
      before: RHYTHMIC_COLOUR_TOP_BUILDER_COPY_BEFORE,
      link: {
        label: RHYTHMIC_COLOUR_TOP_BUILDER_LINK_LABEL,
        href: rhythmicColourTopLandingHref(),
      },
      after: RHYTHMIC_COLOUR_TOP_BUILDER_COPY_AFTER,
    },
    steps: RHYTHMIC_COLOUR_TOP_BUILD_STEPS,
    closing: [
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_HEADING, heading: true },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_INTRO },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_BODY },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_CHOICE, strong: true },
      { text: RHYTHMIC_COLOUR_TOP_ANY_YARN, emphasis: true },
    ],
    cta: RHYTHMIC_COLOUR_TOP_CTA,
  },
  pattern: {
    heading: RHYTHMIC_COLOUR_TOP_INSPIRED_HEADING,
    copy: RHYTHMIC_COLOUR_TOP_INSPIRED_COPY,
    linkLabel: RHYTHMIC_COLOUR_TOP_PATTERN_LINK_LABEL,
    href: RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL,
  },
  yarn: {
    heading: RHYTHMIC_COLOUR_TOP_YARN_HEADING,
    cardHeading: RHYTHMIC_COLOUR_TOP_YARN.heading,
    paragraphs: RHYTHMIC_COLOUR_TOP_YARN.paragraphs,
    buttonLabel: RHYTHMIC_COLOUR_TOP_YARN.buttonLabel,
    href: RHYTHMIC_COLOUR_TOP_YARN.href,
  },
  affiliateDisclosure: RHYTHMIC_COLOUR_TOP_AFFILIATE_DISCLOSURE,
};
