import { buildSockBuilderNewPatternHref } from "../patterns/christmasStocking/sockFreshStart";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../patterns/christmasStockingPatternLanding";
import type { KnitAbleInspirationPageContent } from "./inspirationPage";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PATH = "/knit-ables/christmas-stockings-your-way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL =
  "https://knititnow.com/knit-ables/christmas-stockings-your-way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE = "Christmas Stockings, Your Way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE =
  "Choose your size, use your yarn, and make it your own.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO =
  "Take inspiration from these Knit Picks stockings, then use the Christmas Stocking builder to create your machine knitting instructions at your gauge.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION = `${CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE} ${CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO}`;

/** Knit Picks Holiday Stockings pattern. Awin affiliate link. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fholiday-stockings-knitting-pattern%2Fp%2F52323D";

/** Wool of the Andes Worsted shop page. Awin affiliate link. A shopping option, not a required yarn. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fwool-of-the-andes-worsted-yarn%2Fc%2F5420103";

const IMAGE_DIR = "/images/knit-ables/christmas-stockings";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/christmas-stockings.png`,
    alt: "A person holding two red, white, and blue Christmas stockings, one with a snowflake and one with reindeer.",
    width: 403,
    height: 600,
    fileName: "christmas-stockings.png",
  },
} as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING = "Christmas Stocking builder";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL = "Christmas Stocking builder";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE =
  "Take inspiration from these Knit Picks stockings, then use the ";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER =
  " to create your machine knitting instructions at your gauge.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_MAIN_COPY = [
  "Make a little stocking for a small gift or a larger one to fill with Christmas surprises. Choose from the builder's stocking sizes, swatch your yarn, and enter your gauge.",
  "Add your favorite colors and stitch patterns to the leg and foot, keeping the heel and toe plain. Make matching stockings for the family or give each one its own personality.",
] as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING = "Knit Picks Holiday Stockings";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY =
  "Like the snowflakes and reindeer? The Knit Picks Holiday Stockings hand knitting pattern is available separately. Check its motif widths against your stocking's stitch count when planning your design. Use the Knit It Now builder for your machine knitting shaping instructions.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL = "Shop the Knit Picks Pattern";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING = "Yarn inspiration";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN = {
  heading: "Wool of the Andes Worsted",
  paragraphs: [
    "Wool of the Andes Worsted is one yarn you can shop for this project. Swatch it on your machine and enter the gauge you get.",
  ],
  buttonLabel: "Shop Wool of the Andes Worsted",
  href: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL,
} as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY = CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL = "Create Your Christmas Stocking";

/** Same visitor actions as the Christmas Stocking landing page. The button opens a new stocking in the builder. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_CTA = {
  ...CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta,
  memberLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL,
};

/** New Christmas Stocking, the same entry the landing-page member CTA uses. */
export function christmasStockingsYourWayBuilderHref(): string {
  return buildSockBuilderNewPatternHref();
}

/** Page content for the shared Knit-able inspiration template. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE: KnitAbleInspirationPageContent = {
  path: CHRISTMAS_STOCKINGS_YOUR_WAY_PATH,
  canonicalUrl: CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL,
  title: CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE,
  description: CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
  hero: {
    src: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src,
    alt: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.alt,
    width: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.width,
    height: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.height,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
  },
  tagline: CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE,
  intro: "",
  placeBuilderBesidePhoto: true,
  builder: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING,
    introduction: {
      before: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE,
      link: {
        label: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL,
        href: christmasStockingsYourWayBuilderHref(),
      },
      after: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER,
    },
    steps: [],
    closing: CHRISTMAS_STOCKINGS_YOUR_WAY_MAIN_COPY.map((text) => ({ text })),
    cta: CHRISTMAS_STOCKINGS_YOUR_WAY_CTA,
  },
  pattern: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING,
    copy: CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
    linkLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
  },
  yarn: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING,
    cardHeading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.heading,
    paragraphs: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.paragraphs,
    buttonLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.buttonLabel,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.href,
  },
  affiliateDisclosure: CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
};
