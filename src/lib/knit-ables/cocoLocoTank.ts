import { buildSleevelessBuilderNewPatternHref } from "../patterns/patternStorage";
import {
  SLEEVELESS_PATTERN_BUILDER_LANDING,
  SLEEVELESS_PATTERN_LANDING_PATH,
} from "../patterns/sleevelessPatternLanding";

export const COCO_LOCO_TANK_PATH = "/knit-ables/coco-loco-tank";

export const COCO_LOCO_TANK_CANONICAL_URL =
  "https://knititnow.com/knit-ables/coco-loco-tank";

export const COCO_LOCO_TANK_TITLE = "Coco Loco Tank";

/** Knit Picks Coco Loco Tank pattern. Awin affiliate link. */
export const COCO_LOCO_TANK_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fcoco-loco-tank-knitting-pattern%2Fp%2FN9181";

/** Featured yarn shop page. Awin affiliate link. */
export const COCO_LOCO_TANK_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fmellizas-sock-yarn%2Fc%2F5420534";

export const COCO_LOCO_TANK_IMAGES = {
  hero: {
    src: "/images/knit-ables/coco-loco-tank.jpg",
    alt: "A person wearing a white sleeveless tank with bright pink, lime, and orange horizontal stripes, hands in the pockets of denim shorts.",
    width: 750,
    height: 1000,
    fileName: "coco-loco-tank.jpg",
  },
} as const;

export const COCO_LOCO_TANK_INTRO_LEAD = "Simple shape. Playful stripes. Your machine.";

export const COCO_LOCO_TANK_INTRO =
  "A few colorful stripes can give a simple tank a whole new personality. The Coco Loco Tank by Twin Stitches Designs pairs a sleeveless shape with pops of contrast color, making it a fun starting point for your next machine knitting project.";

export const COCO_LOCO_TANK_BUILDER_HEADING =
  "Make it yours with the KIN Sleeveless builder";

export const COCO_LOCO_TANK_BUILDER_LINK_LABEL = "Knit It Now Sleeveless builder";

export const COCO_LOCO_TANK_BUILDER_COPY_BEFORE = "Use the ";

export const COCO_LOCO_TANK_BUILDER_COPY_AFTER =
  " to create your basic tank, then add your own stripe arrangement.";

export const COCO_LOCO_TANK_BUILD_STEPS = [
  "Choose your size and preferred fit.",
  "Adjust the length to suit your style.",
  "Swatch your yarn and enter your stitch and row gauge.",
  "Choose a main color and add contrasting stripes.",
] as const;

export const COCO_LOCO_TANK_STRIPE_NOTE =
  "Keep the colors soft and subtle, go bright, or put those small amounts of leftover yarn to work.";

export const COCO_LOCO_TANK_ANY_YARN = "Any yarn. Any machine. Your creativity.";

export const COCO_LOCO_TANK_MEMBER_LESSONS_HEADING = "Helpful member lessons";

export const COCO_LOCO_TANK_MEMBER_LESSONS_INTRO =
  "Two videos to help you explore stripe ideas and keep your seams looking neat.";

/** Same access label the Branch Out Tank lesson uses. */
export const COCO_LOCO_TANK_MEMBER_LESSON_ACCESS_LABEL = "Members";

export const COCO_LOCO_TANK_MEMBER_LESSONS = [
  {
    title: "Perfect Jog-less Stripes",
    description: "Keep your stripes aligned when seaming your tank.",
    href: "/videos/597",
  },
  {
    title: "Yipes Stripes",
    description: "Explore more possibilities with stripes and vertical textures.",
    href: "/videos/442",
  },
] as const;

export const COCO_LOCO_TANK_INSPIRED_HEADING = "Inspired by Coco Loco";

export const COCO_LOCO_TANK_INSPIRED_COPY =
  "The original Coco Loco is a hand knitting pattern. Use it for inspiration while following your KIN pattern for machine knitting construction and shaping. Your neckline, armholes, and finishing may differ from the original.";

export const COCO_LOCO_TANK_PATTERN_LINK_LABEL =
  "Explore the Coco Loco hand knitting pattern";

export const COCO_LOCO_TANK_YARN_HEADING = "Yarn inspiration";

export const COCO_LOCO_TANK_YARN = {
  heading: "Knit Picks Mellizas",
  paragraphs: [
    "The original design uses Knit Picks Mellizas, a fingering weight yarn. Use the featured yarn or choose a yarn that works well with your machine and gives you a fabric you love.",
  ],
  buttonLabel: "Explore Mellizas yarn and colors",
  href: COCO_LOCO_TANK_YARN_URL,
} as const;

export const COCO_LOCO_TANK_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

export const COCO_LOCO_TANK_CARD_COPY =
  "Use the Knit It Now Sleeveless builder to create a basic tank, then add your own stripe arrangement.";

/** Same member and visitor actions as the Sleeveless pattern landing page. */
export const COCO_LOCO_TANK_CTA = SLEEVELESS_PATTERN_BUILDER_LANDING.cta;

/** Public Sleeveless pattern landing page. */
export function cocoLocoTankLandingHref(): string {
  return SLEEVELESS_PATTERN_LANDING_PATH;
}

/** New Sleeveless pattern, the same entry the landing-page member CTA uses. */
export function cocoLocoTankBuilderHref(): string {
  return buildSleevelessBuilderNewPatternHref();
}
