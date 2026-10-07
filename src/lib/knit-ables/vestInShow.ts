import { buildSleevelessBuilderNewPatternHref } from "../patterns/patternStorage";
import {
  SLEEVELESS_PATTERN_BUILDER_LANDING,
  SLEEVELESS_PATTERN_LANDING_PATH,
} from "../patterns/sleevelessPatternLanding";
import type { KnitAbleInspirationPageContent } from "./inspirationPage";

export const VEST_IN_SHOW_PATH = "/knit-ables/vest-in-show";

export const VEST_IN_SHOW_CANONICAL_URL = "https://knititnow.com/knit-ables/vest-in-show";

export const VEST_IN_SHOW_TITLE = "Vest in Show";

export const VEST_IN_SHOW_DESCRIPTION =
  "Love the Vest in Show look? Use your knitting machine, your gauge, and your measurements to create a custom sleeveless V-neck inspired by this colorful Sirdar design.";

/** Sirdar Vest in Show pattern. Awin affiliate link. */
export const VEST_IN_SHOW_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2F10844-vest-in-show-pullover-knitting-pattern-in-sirdar-jewelspun-ombre";

/** Sirdar Jewelspun Ombre shop page. Awin affiliate link. */
export const VEST_IN_SHOW_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2Fsirdar-jewelspun-ombre-aran-400g";

const IMAGE_DIR = "/images/knit-ables/vest-in-show";

export const VEST_IN_SHOW_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/vest-in-show.gif`,
    alt: "A person wearing a gray ombre V-neck sleeveless pullover with ribbed trim at the neckline, armholes, and hem, layered over a white shirt.",
    width: 500,
    height: 638,
    fileName: "vest-in-show.gif",
  },
} as const;

export const VEST_IN_SHOW_TAGLINE =
  "Simple shape + gorgeous yarn = a great machine knitting project.";

export const VEST_IN_SHOW_INTRO = [
  "Vest in Show is a classic sleeveless pullover from Sirdar featuring a V-neck, simple stockinette fabric, and ribbed finishing.",
  "The long color changes in the yarn provide the visual interest while the garment shape stays beautifully simple.",
  "It's a great candidate for recreating the look on a knitting machine using your own measurements and gauge.",
] as const;

export const VEST_IN_SHOW_BUILDER_HEADING = "Make it on your knitting machine";

export const VEST_IN_SHOW_BUILDER_LINK_LABEL = "Sleeveless Pattern";

export const VEST_IN_SHOW_BUILDER_COPY_BEFORE = "Use the Knit it Now ";

export const VEST_IN_SHOW_BUILDER_COPY_AFTER = " to create your own version. Choose:";

export const VEST_IN_SHOW_BUILD_STEPS = [
  "Pullover",
  "V-neck",
  "Your preferred finished length",
  "Your desired V-neck depth",
  "Your own measurements",
  "Your own gauge",
] as const;

export const VEST_IN_SHOW_RIBBING_NOTE =
  "Add ribbing at the hem, neckline, and armholes to capture the look of the original.";

export const VEST_IN_SHOW_KNITTER_TIP =
  "Machine knitter's tip: Because the color placement will vary depending on where you begin in the yarn and the width of your knitted pieces, embrace the variations. Your vest will be unique.";

export const VEST_IN_SHOW_INSPIRED_HEADING = "Inspired by Vest in Show";

export const VEST_IN_SHOW_INSPIRED_COPY =
  "Vest in Show is Sirdar's hand-knitting pattern for a sleeveless pullover. Use the original garment as inspiration and create a custom machine-knit vest with the Knit it Now Sleeveless Pattern, your measurements, and your gauge. Knit it Now does not reproduce or provide Sirdar's copyrighted pattern.";

export const VEST_IN_SHOW_PATTERN_LINK_LABEL = "Get the Original Pattern";

export const VEST_IN_SHOW_YARN_HEADING = "Yarn inspiration";

export const VEST_IN_SHOW_YARN = {
  heading: "Sirdar Jewelspun Ombre",
  paragraphs: [
    "The original uses Sirdar Jewelspun Ombre, an Aran-weight yarn with long color changes.",
    "The hand-knitting pattern lists a gauge of approximately 18 stitches and 24 rows per 4 inches. Machine knitters should not try to match the hand-knitting gauge.",
    "Swatch the yarn on your machine and use YOUR gauge when creating your Knit it Now pattern.",
    "The long color changes make simple stockinette visually interesting without requiring a complicated stitch pattern.",
  ],
  buttonLabel: "Shop the Yarn",
  href: VEST_IN_SHOW_YARN_URL,
} as const;

export const VEST_IN_SHOW_MEMBER_LESSONS_HEADING = "Finishing Your V-Neck";

export const VEST_IN_SHOW_MEMBER_LESSONS_INTRO =
  "Give your vest a professional finish! Learn how to knit and attach a V-neck band for a neat, polished neckline.";

/** Same access label the other Knit-able member lessons use. */
export const VEST_IN_SHOW_MEMBER_LESSON_ACCESS_LABEL = "Members";

/** Existing member lesson. The player loads catalog video 386; this page does not host the file. */
export const VEST_IN_SHOW_MEMBER_LESSONS = [
  {
    title: "V-Neck Bands",
    description: "Shape a practice neckline and knit a doubled stockinette V-neck band.",
    href: "/videos/386",
  },
] as const;

export const VEST_IN_SHOW_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

export const VEST_IN_SHOW_CARD_COPY =
  "Use the Knit it Now Sleeveless Pattern to create a custom sleeveless V-neck inspired by this colorful Sirdar design.";

export const VEST_IN_SHOW_CTA_LABEL = "Create Your Sleeveless Pattern";

/** Same member and visitor actions as the Sleeveless pattern landing page, with this page's button label. */
export const VEST_IN_SHOW_CTA = {
  ...SLEEVELESS_PATTERN_BUILDER_LANDING.cta,
  memberLabel: VEST_IN_SHOW_CTA_LABEL,
};

/** Public Sleeveless pattern landing page. */
export function vestInShowLandingHref(): string {
  return SLEEVELESS_PATTERN_LANDING_PATH;
}

/** New Sleeveless pattern, the same entry the landing-page member CTA uses. */
export function vestInShowBuilderHref(): string {
  return buildSleevelessBuilderNewPatternHref();
}

/** Page content for the shared Knit-able inspiration template. */
export const VEST_IN_SHOW_PAGE: KnitAbleInspirationPageContent = {
  path: VEST_IN_SHOW_PATH,
  canonicalUrl: VEST_IN_SHOW_CANONICAL_URL,
  title: VEST_IN_SHOW_TITLE,
  description: VEST_IN_SHOW_DESCRIPTION,
  hero: {
    src: VEST_IN_SHOW_IMAGES.hero.src,
    alt: VEST_IN_SHOW_IMAGES.hero.alt,
    width: VEST_IN_SHOW_IMAGES.hero.width,
    height: VEST_IN_SHOW_IMAGES.hero.height,
    href: VEST_IN_SHOW_ORIGINAL_PATTERN_URL,
  },
  tagline: VEST_IN_SHOW_TAGLINE,
  intro: VEST_IN_SHOW_INTRO,
  builder: {
    heading: VEST_IN_SHOW_BUILDER_HEADING,
    introduction: {
      before: VEST_IN_SHOW_BUILDER_COPY_BEFORE,
      link: {
        label: VEST_IN_SHOW_BUILDER_LINK_LABEL,
        href: vestInShowLandingHref(),
      },
      after: VEST_IN_SHOW_BUILDER_COPY_AFTER,
    },
    steps: VEST_IN_SHOW_BUILD_STEPS,
    closing: [
      { text: VEST_IN_SHOW_RIBBING_NOTE },
      { text: VEST_IN_SHOW_KNITTER_TIP },
    ],
    cta: VEST_IN_SHOW_CTA,
  },
  pattern: {
    heading: VEST_IN_SHOW_INSPIRED_HEADING,
    copy: VEST_IN_SHOW_INSPIRED_COPY,
    linkLabel: VEST_IN_SHOW_PATTERN_LINK_LABEL,
    href: VEST_IN_SHOW_ORIGINAL_PATTERN_URL,
  },
  yarn: {
    heading: VEST_IN_SHOW_YARN_HEADING,
    cardHeading: VEST_IN_SHOW_YARN.heading,
    paragraphs: VEST_IN_SHOW_YARN.paragraphs,
    buttonLabel: VEST_IN_SHOW_YARN.buttonLabel,
    href: VEST_IN_SHOW_YARN.href,
  },
  lessons: {
    heading: VEST_IN_SHOW_MEMBER_LESSONS_HEADING,
    intro: VEST_IN_SHOW_MEMBER_LESSONS_INTRO,
    accessLabel: VEST_IN_SHOW_MEMBER_LESSON_ACCESS_LABEL,
    items: VEST_IN_SHOW_MEMBER_LESSONS,
  },
  affiliateDisclosure: VEST_IN_SHOW_AFFILIATE_DISCLOSURE,
};
